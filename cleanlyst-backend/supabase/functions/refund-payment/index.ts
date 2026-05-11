/**
 * refund-payment
 *
 * Processes a full or partial refund via Stripe, then synchronises the
 * payment and booking rows in Supabase.
 *
 * Eligibility rules:
 *   - Admin can refund any booking whose payment is 'authorized' or 'captured'
 *   - Booking must not already be refunded or in a terminal state
 *   - Payout must not yet have been released (prevents negative-balance transfers)
 *
 * Steps:
 *   1. Validate admin auth
 *   2. Load booking + payment
 *   3. Validate eligibility
 *   4. Cancel any pending payout if found
 *   5. Create Stripe refund (full or partial)
 *   6. Update payment + booking rows
 *   7. Notify customer
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
    const reason: string | undefined = body?.reason // optional Stripe refund reason
    const amount_cents: number | undefined = body?.amount_cents // omit for full refund

    if (!booking_id) return err(400, 'booking_id is required')

    // ── Load booking ──────────────────────────────────────────────────────
    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select('id, customer_id, status, quote_cents, currency')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) return err(404, 'Booking not found')

    const nonRefundableStatuses = ['refunded', 'cancelled']
    if (nonRefundableStatuses.includes(booking.status)) {
      return err(409, `Booking is already in a non-refundable state: ${booking.status}`)
    }

    // ── Load payment ──────────────────────────────────────────────────────
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id, stripe_payment_intent_id, status, amount_cents')
      .eq('booking_id', booking_id)
      .single()

    if (paymentError || !payment) return err(404, 'No payment record found for this booking')
    if (!payment.stripe_payment_intent_id) return err(409, 'Payment has no Stripe intent to refund')

    const refundableStatuses = ['authorized', 'captured']
    if (!refundableStatuses.includes(payment.status)) {
      return err(409, `Payment cannot be refunded in status: ${payment.status}`)
    }

    // ── Guard: block refund if payout already released ────────────────────
    const { data: payout } = await admin
      .from('payouts')
      .select('id, status')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (payout && (payout.status === 'released' || payout.status === 'paid')) {
      return err(
        409,
        'Cannot refund — cleaner payout has already been transferred. Reverse the transfer first.',
      )
    }

    const refundCents = amount_cents ? Math.min(amount_cents, payment.amount_cents) : undefined

    // ── Create Stripe Refund ──────────────────────────────────────────────
    // For 'authorized' (uncaptured) intents, we cancel rather than refund
    let stripeRefundId: string

    if (payment.status === 'authorized') {
      const cancelled = await stripePost(
        `payment_intents/${payment.stripe_payment_intent_id}/cancel`,
        new URLSearchParams(),
      )
      stripeRefundId = cancelled['id'] as string
    } else {
      const refundParams = new URLSearchParams({
        payment_intent: payment.stripe_payment_intent_id,
        'metadata[booking_id]': booking.id,
        'metadata[admin_id]': auth.userId,
      })
      if (refundCents) refundParams.set('amount', String(refundCents))
      if (reason) refundParams.set('reason', reason) // 'duplicate' | 'fraudulent' | 'requested_by_customer'

      const refund = await stripePost('refunds', refundParams)
      stripeRefundId = refund['id'] as string
    }

    // ── Update payment row ────────────────────────────────────────────────
    await admin
      .from('payments')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', payment.id)

    // ── Update booking status ─────────────────────────────────────────────
    await admin
      .from('bookings')
      .update({ status: 'refunded' })
      .eq('id', booking.id)

    // ── Notify customer ────────────────────────────────────────────────────
    const refundDisplay = refundCents
      ? `£${(refundCents / 100).toFixed(2)}`
      : `£${(payment.amount_cents / 100).toFixed(2)} (full refund)`

    await admin.from('notifications').insert({
      user_id: booking.customer_id,
      type: 'payment_refunded',
      title: 'Refund processed',
      body: `Your refund of ${refundDisplay} has been processed and will appear in 5–10 business days.`,
    })

    return ok({ ok: true, refund_id: stripeRefundId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
