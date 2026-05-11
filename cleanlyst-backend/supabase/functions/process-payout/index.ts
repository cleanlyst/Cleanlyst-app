/**
 * process-payout
 *
 * Admin-only. Captures the held PaymentIntent and transfers the cleaner's
 * share to their Stripe Connect account.
 *
 * Pre-conditions:
 *   - Booking must be in 'completed' status
 *   - Cleaner must have a connected Stripe account (stripe_account_id)
 *   - Payment must be 'authorized' or 'captured' (not refunded/failed)
 *   - No duplicate payout already released for this booking
 *
 * Steps:
 *   1. Validate admin auth
 *   2. Load booking + payment + cleaner profile
 *   3. Capture the held PaymentIntent (if not already captured)
 *   4. Create Stripe Transfer to cleaner's Connect account
 *   5. Upsert payout record
 *   6. Notify cleaner
 *
 * Note: The existing release-payout function performs the same operation.
 * This function is the canonical implementation aligned to the API spec naming.
 */

import { corsHeaders, err, makeAdminClient, ok, requireRole, stripePost } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    const auth = await requireRole(req.headers.get('Authorization'), admin, 'admin')
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const booking_id: string | undefined = body?.booking_id
    if (!booking_id) return err(400, 'booking_id is required')

    // ── Load booking ──────────────────────────────────────────────────────
    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select('id, cleaner_id, status, cleaner_payout_cents, currency')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) return err(404, 'Booking not found')
    if (booking.status !== 'completed') {
      return err(409, `Booking must be completed before payout (status: ${booking.status})`)
    }

    const payoutCents = Number(booking.cleaner_payout_cents ?? 0)
    if (payoutCents <= 0) return err(400, 'Booking has no cleaner payout amount set')

    // ── Check for duplicate payout ─────────────────────────────────────────
    const { data: existingPayout } = await admin
      .from('payouts')
      .select('id, status, stripe_transfer_id')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (existingPayout?.status === 'released' || existingPayout?.status === 'paid') {
      return err(409, `Payout already processed (status: ${existingPayout.status})`)
    }

    // ── Load payment record ────────────────────────────────────────────────
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id, stripe_payment_intent_id, status')
      .eq('booking_id', booking_id)
      .single()

    if (paymentError || !payment) return err(404, 'Payment record not found for booking')
    if (!payment.stripe_payment_intent_id) return err(409, 'Payment has no Stripe intent — cannot payout')
    if (payment.status === 'refunded') return err(409, 'Payment has been refunded — cannot payout')
    if (payment.status === 'failed') return err(409, 'Payment failed — cannot payout')

    // ── Load cleaner Stripe account ────────────────────────────────────────
    const { data: cleanerProfile, error: cleanerError } = await admin
      .from('cleaner_profiles')
      .select('stripe_account_id')
      .eq('user_id', booking.cleaner_id)
      .single()

    if (cleanerError || !cleanerProfile?.stripe_account_id) {
      return err(409, 'Cleaner does not have a connected Stripe account')
    }

    const currency = String(booking.currency ?? 'GBP').toLowerCase()

    // ── Capture PaymentIntent if still authorized ──────────────────────────
    if (payment.status === 'authorized') {
      await stripePost(
        `payment_intents/${payment.stripe_payment_intent_id}/capture`,
        new URLSearchParams(),
      )

      await admin
        .from('payments')
        .update({ status: 'captured', captured_at: new Date().toISOString() })
        .eq('id', payment.id)
    }

    // ── Create Stripe Transfer to cleaner ──────────────────────────────────
    const transfer = await stripePost(
      'transfers',
      new URLSearchParams({
        amount: String(payoutCents),
        currency,
        destination: cleanerProfile.stripe_account_id,
        'metadata[booking_id]': booking.id,
        'metadata[cleaner_id]': booking.cleaner_id,
      }),
    )

    // ── Upsert payout record ───────────────────────────────────────────────
    const { error: payoutError } = await admin.from('payouts').upsert(
      {
        booking_id: booking.id,
        cleaner_id: booking.cleaner_id,
        payment_id: payment.id,
        amount_cents: payoutCents,
        currency: booking.currency ?? 'GBP',
        stripe_transfer_id: transfer['id'] as string,
        status: 'released',
        released_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )

    if (payoutError) throw payoutError

    // ── Notify cleaner ─────────────────────────────────────────────────────
    await admin.from('notifications').insert({
      user_id: booking.cleaner_id,
      type: 'payout_released',
      title: 'Payout sent',
      body: `Your payout of £${(payoutCents / 100).toFixed(2)} has been transferred to your account.`,
    })

    return ok({ ok: true, transfer_id: transfer['id'] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
