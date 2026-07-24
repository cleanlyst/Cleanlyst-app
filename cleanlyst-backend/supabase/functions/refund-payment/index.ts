/**
 * refund-payment
 *
 * THE canonical, single source of truth for issuing a refund. Every refund
 * entry point in the app (admin Operations Console, admin Booking
 * Management, customer cancellation auto-refund, cleaner no-show refund)
 * must call this function — directly or via paymentOrchestrator.refundPayment.
 * Nothing else may mark a payment/booking as refunded.
 *
 * Eligibility rules:
 *   - Admin can refund any booking whose payment is 'authorized' or 'captured'
 *   - Customer can cancel their own booking's payment ONLY when status = 'authorized'
 *     (uncaptured Stripe authorization — no money has moved yet)
 *   - Booking must not already be refunded or in a terminal state
 *   - Payout must not yet have been released (prevents negative-balance transfers)
 *
 * Steps (money moves BEFORE any local state changes — never the reverse):
 *   1. Validate auth (admin or booking owner for authorized cancels)
 *   2. Load booking + payment
 *   3. Validate eligibility (business rules)
 *   4. Guard against payout-already-released
 *   5. Call Stripe (refund or cancel), with an Idempotency-Key derived from
 *      the payment id — a retry of the same not-yet-completed refund
 *      (double click, refresh, network retry, duplicate admin click)
 *      returns Stripe's original result instead of creating a second one
 *   6. Only once Stripe confirms: update payments row, update bookings row
 *      (full refunds only — a partial refund does not terminate the booking)
 *   7. Notify customer and cleaner
 *   8. (async) the Stripe webhook later records the authoritative
 *      payment_ledger_events row and payment_status once charge.refunded /
 *      payment_intent.canceled arrives — this function never writes the
 *      ledger or payment_status directly, matching the rest of the app's
 *      "webhook is the sole writer of payment_status" invariant
 *
 * If Stripe's call throws, execution stops at step 5 — nothing below it
 * runs, so no local state changes and no false "refunded" notification is
 * ever sent for a refund Stripe didn't actually process.
 */

import { corsHeaders, err, makeAdminClient, ok, requireRole, stripePost } from '../_shared/utils.ts'

// Stripe's refund `reason` param only accepts these three values. Callers
// (admin UI, customer cancellation, no-show refund) pass richer business
// reason codes for our own audit trail (payments.refund_reason /
// metadata[reason]) — this maps the subset that has a clear Stripe
// equivalent and omits the param entirely for anything else, since sending
// an invalid enum value would make Stripe reject the whole refund request.
const STRIPE_REFUND_REASONS = new Set(['duplicate', 'fraudulent', 'requested_by_customer'])

function toStripeRefundReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined
  if (STRIPE_REFUND_REASONS.has(reason)) return reason
  if (reason === 'duplicate_payment') return 'duplicate'
  if (reason === 'customer_cancellation') return 'requested_by_customer'
  return undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    // Accept admin for full refund control; customer for cancelling their own authorized payment.
    const auth = await requireRole(req.headers.get('Authorization'), admin, 'admin', 'customer')
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const booking_id: string | undefined = body?.booking_id
    const reason: string | undefined = body?.reason // optional Stripe refund reason
    const amount_cents: number | undefined = body?.amount_cents // omit for full refund

    if (!booking_id) return err(400, 'booking_id is required')

    // ── Load booking ──────────────────────────────────────────────────────
    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select('id, customer_id, cleaner_id, status, quote_cents, currency')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) return err(404, 'Booking not found')

    // Customers may only act on their own bookings.
    if (auth.role === 'customer' && auth.userId !== booking.customer_id) {
      return err(403, 'Forbidden — you do not own this booking')
    }

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

    // Customers can only cancel uncaptured authorizations (no money transferred yet).
    if (auth.role === 'customer' && payment.status !== 'authorized') {
      return err(403, 'Customers can only cancel uncaptured payment authorizations — contact support for captured payment refunds')
    }

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
    const isFullRefund = !refundCents || refundCents === payment.amount_cents

    // Deterministic per-payment key: any retry of this same not-yet-completed
    // refund (double click, browser refresh, network retry) reuses the same
    // key so Stripe returns the original result instead of creating a second
    // refund/cancel. Once this payment reaches a terminal status the
    // eligibility checks above reject further calls, so the key never needs
    // to be reused for a genuinely new operation on the same payment.
    const idempotencyKey = `refund_${payment.id}`

    // ── Create Stripe Refund ──────────────────────────────────────────────
    // For 'authorized' (uncaptured) intents, we cancel rather than refund
    let stripeRefundId: string

    if (payment.status === 'authorized') {
      const cancelled = await stripePost(
        `payment_intents/${payment.stripe_payment_intent_id}/cancel`,
        new URLSearchParams(),
        idempotencyKey,
      )
      stripeRefundId = cancelled['id'] as string
    } else {
      const refundParams = new URLSearchParams({
        payment_intent: payment.stripe_payment_intent_id,
        'metadata[booking_id]': booking.id,
        'metadata[initiated_by]': auth.userId,
      })
      if (refundCents) refundParams.set('amount', String(refundCents))
      // Callers pass business-facing reason codes (e.g. 'cleaner_no_show',
      // 'customer_cancellation') for our own audit trail — reason below —
      // but Stripe's refund `reason` param only accepts a fixed enum. Map
      // to the closest valid value; omit entirely rather than send an
      // invalid value Stripe would reject the whole request for.
      const stripeReason = toStripeRefundReason(reason)
      if (stripeReason) refundParams.set('reason', stripeReason)
      if (reason) refundParams.set('metadata[reason]', reason)

      const refund = await stripePost('refunds', refundParams, idempotencyKey)
      stripeRefundId = refund['id'] as string
    }

    // ── Stripe confirmed — now, and only now, mutate local state ───────────

    // Update payment row.
    await admin
      .from('payments')
      .update({
        status:        isFullRefund ? 'refunded' : payment.status,
        refund_cents:  refundCents ?? payment.amount_cents,
        refund_reason: reason ?? null,
        refunded_by:   auth.userId,
        refunded_at:   new Date().toISOString(),
      })
      .eq('id', payment.id)

    // Update booking status — only a FULL refund terminates the booking.
    // A partial refund (e.g. goodwill adjustment) leaves the booking's
    // lifecycle untouched. payment_status is NOT set here — the Stripe
    // webhook (payment_intent.canceled for authorization cancels,
    // charge.refunded for captured refunds) is the sole writer of
    // bookings.payment_status.
    if (isFullRefund) {
      await admin
        .from('bookings')
        .update({ status: 'refunded' })
        .eq('id', booking.id)
    }

    // ── Notify customer ────────────────────────────────────────────────────
    const refundDisplay = `£${((refundCents ?? payment.amount_cents) / 100).toFixed(2)}`

    await admin.from('notifications').insert({
      user_id: booking.customer_id,
      type: 'payment_refunded',
      title: isFullRefund ? 'Refund processed' : 'Partial refund processed',
      body: `Your ${isFullRefund ? '' : 'partial '}refund of ${refundDisplay} has been processed and will appear in 5–10 business days.`,
      booking_id: booking.id,
      metadata: { booking_id: booking.id, refund_id: stripeRefundId, refund_cents: refundCents ?? payment.amount_cents, is_full: isFullRefund },
    })

    // Notify cleaner too, mirroring admin_process_refund's prior behaviour.
    if (booking.cleaner_id) {
      await admin.from('notifications').insert({
        user_id: booking.cleaner_id,
        type: 'payment_refunded',
        title: 'Refund issued on your booking',
        body: `A ${isFullRefund ? 'full' : 'partial'} refund of ${refundDisplay} has been issued for this booking.`,
        booking_id: booking.id,
        metadata: { booking_id: booking.id, refund_id: stripeRefundId, is_full: isFullRefund },
      })
    }

    return ok({
      ok:           true,
      refund_id:    stripeRefundId,
      is_full:      isFullRefund,
      refund_cents: refundCents ?? payment.amount_cents,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
