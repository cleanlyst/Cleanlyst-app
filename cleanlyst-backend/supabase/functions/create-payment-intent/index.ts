/**
 * create-payment-intent
 *
 * Creates a Stripe PaymentIntent for the Stripe Elements (custom UI) flow.
 * Complements create-checkout-session which uses Stripe's hosted checkout.
 *
 * Flow:
 *   1. Customer calls this function with a booking_id
 *   2. Function validates ownership and booking state
 *   3. Creates (or retrieves existing) Stripe PaymentIntent
 *   4. Persists intent reference in payments table
 *   5. Returns client_secret — used by the frontend to confirm payment via Elements
 *
 * After the customer confirms, Stripe fires checkout.session.completed or
 * payment_intent.succeeded which the stripe-webhook function handles.
 */

import { corsHeaders, err, makeAdminClient, ok, requireRole, stripeGet, stripePost } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    const auth = await requireRole(req.headers.get('Authorization'), admin, 'customer')
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const booking_id: string | undefined = body?.booking_id
    if (!booking_id) return err(400, 'booking_id is required')

    // ── Fetch booking ──────────────────────────────────────────────────────
    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select('id, customer_id, status, quote_cents, currency, service_title_snapshot, cleaner_payout_cents, cleaner_id')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) return err(404, 'Booking not found')
    if (booking.customer_id !== auth.userId) return err(403, 'Forbidden')
    if (booking.status !== 'awaiting_customer_payment') {
      return err(409, `Booking cannot be paid in status: ${booking.status}`)
    }

    const amountCents = Math.max(Number(booking.quote_cents ?? 0), 0)
    if (amountCents < 50) return err(400, 'Booking amount too small (minimum 50 pence)')

    const currency = String(booking.currency ?? 'GBP').toLowerCase()

    // ── Idempotency: return existing unpaid intent ─────────────────────────
    const { data: existing } = await admin
      .from('payments')
      .select('id, stripe_payment_intent_id, status')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (existing?.stripe_payment_intent_id) {
      if (existing.status === 'authorized' || existing.status === 'captured') {
        return err(409, 'Booking already has a successful payment')
      }
      // Return the existing intent so the frontend can re-render Elements
      const intent = await stripeGet(`payment_intents/${existing.stripe_payment_intent_id}`)
      return ok({
        client_secret: intent['client_secret'],
        payment_intent_id: intent['id'],
        amount_cents: amountCents,
        currency,
      })
    }

    // ── Fetch cleaner Stripe account for application_fee routing ──────────
    const { data: cleanerProfile } = await admin
      .from('cleaner_profiles')
      .select('stripe_account_id')
      .eq('user_id', booking.cleaner_id)
      .maybeSingle()

    // ── Create PaymentIntent ───────────────────────────────────────────────
    const platformFeeCents = amountCents - Number(booking.cleaner_payout_cents ?? 0)

    const params = new URLSearchParams({
      amount: String(amountCents),
      currency,
      capture_method: 'manual', // Captured after booking completion via process-payout
      'metadata[booking_id]': booking.id,
      'metadata[customer_id]': booking.customer_id,
    })

    // Route through Connect account if the cleaner has one
    if (cleanerProfile?.stripe_account_id && platformFeeCents > 0) {
      params.set('application_fee_amount', String(platformFeeCents))
      params.set('transfer_data[destination]', cleanerProfile.stripe_account_id)
    }

    const intent = await stripePost('payment_intents', params)

    // ── Persist payment record ─────────────────────────────────────────────
    const { error: upsertError } = await admin.from('payments').upsert(
      {
        booking_id: booking.id,
        stripe_payment_intent_id: intent['id'] as string,
        status: 'unpaid',
        amount_cents: amountCents,
        currency: booking.currency ?? 'GBP',
      },
      { onConflict: 'booking_id' },
    )

    if (upsertError) throw upsertError

    return ok({
      client_secret: intent['client_secret'],
      payment_intent_id: intent['id'],
      amount_cents: amountCents,
      currency,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
