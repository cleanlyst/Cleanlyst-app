/**
 * Backend Payment State Machine
 *
 * Single authoritative handler for all Stripe event → database transitions.
 * Called exclusively by the stripe-webhook Edge Function.
 *
 * INVARIANTS:
 *   - This module is the ONLY place that writes bookings.payment_status
 *   - This module is the ONLY place that transitions booking.status based on payment events
 *   - Idempotency is enforced per-handler via pre-read guards
 *   - service_role (caller role) bypasses trg_guard_booking_status_write — intentional
 *
 * DO NOT import this from any Edge Function other than stripe-webhook.
 * DO NOT add API calls, business-logic RPCs, or Stripe calls here.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface PaymentEventContext {
  stripeEventId: string
  /** Resolved from event.data.object.metadata.booking_id — may be empty */
  bookingId: string
  paymentIntentId: string
  /** Present only for checkout.session.completed */
  sessionId?: string
  /** Present only for transfer.paid */
  transferId?: string
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

async function resolveBookingId(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<string> {
  if (ctx.bookingId) return ctx.bookingId
  if (!ctx.paymentIntentId) return ''
  const { data } = await admin
    .from('payments')
    .select('booking_id')
    .eq('stripe_payment_intent_id', ctx.paymentIntentId)
    .maybeSingle()
  return data?.booking_id ?? ''
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  if (!ctx.bookingId) return

  const { data: pre } = await admin
    .from('bookings')
    .select('status')
    .eq('id', ctx.bookingId)
    .maybeSingle()

  // Idempotent: already in payment_authorized
  if (pre?.status === 'payment_authorized') return

  await admin
    .from('payments')
    .update({
      stripe_checkout_session_id: ctx.sessionId ?? null,
      stripe_payment_intent_id: ctx.paymentIntentId || null,
      status: 'authorized',
      authorized_at: new Date().toISOString(),
      last_webhook_event_id: ctx.stripeEventId,
    })
    .eq('booking_id', ctx.bookingId)

  await admin
    .from('bookings')
    .update({ status: 'payment_authorized', payment_status: 'authorized' })
    .eq('id', ctx.bookingId)

  await admin.from('booking_status_events').insert({
    booking_id: ctx.bookingId,
    from_status: pre?.status ?? null,
    to_status: 'payment_authorized',
    actor_id: null,
    actor_role: 'system',
    notes: `Stripe webhook: checkout.session.completed (event_id: ${ctx.stripeEventId})`,
  })
}

async function handlePaymentCaptured(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  const bookingId = await resolveBookingId(ctx, admin)
  if (!bookingId) {
    console.error(
      `[paymentStateMachine] payment_intent.succeeded: cannot resolve booking_id for intent ${ctx.paymentIntentId}`,
    )
    return
  }

  await admin
    .from('payments')
    .update({
      status: 'captured',
      captured_at: new Date().toISOString(),
      last_webhook_event_id: ctx.stripeEventId,
    })
    .eq('stripe_payment_intent_id', ctx.paymentIntentId)

  await admin
    .from('bookings')
    .update({ payment_status: 'captured' })
    .eq('id', bookingId)

  // PaymentCaptured → booking becomes 'paid' (if currently authorized)
  const { data: booking } = await admin
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle()

  if (booking?.status === 'payment_authorized') {
    await admin
      .from('bookings')
      .update({ status: 'paid' })
      .eq('id', bookingId)

    await admin.from('booking_status_events').insert({
      booking_id: bookingId,
      from_status: 'payment_authorized',
      to_status: 'paid',
      actor_id: null,
      actor_role: 'system',
      notes: `Stripe webhook: payment_intent.succeeded — payment captured (event_id: ${ctx.stripeEventId})`,
    })
  }
}

async function handlePaymentFailed(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  if (!ctx.paymentIntentId) return
  await admin
    .from('payments')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      last_webhook_event_id: ctx.stripeEventId,
    })
    .eq('stripe_payment_intent_id', ctx.paymentIntentId)
  // booking.status unchanged — payment failure doesn't auto-cancel the booking
}

async function handlePaymentCanceled(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  // Fires when refund-payment EF cancels an uncaptured PaymentIntent.
  // refund-payment already set bookings.status = 'refunded'.
  // This handler is the sole writer of bookings.payment_status for this path.
  const bookingId = await resolveBookingId(ctx, admin)
  if (!bookingId) {
    console.error(
      `[paymentStateMachine] payment_intent.canceled: cannot resolve booking_id for intent ${ctx.paymentIntentId}`,
    )
    return
  }

  await admin
    .from('payments')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      last_webhook_event_id: ctx.stripeEventId,
    })
    .eq('stripe_payment_intent_id', ctx.paymentIntentId)

  await admin
    .from('bookings')
    .update({ payment_status: 'refunded' })
    .eq('id', bookingId)
  // bookings.status already 'refunded' from refund-payment EF — no double-write
}

async function handleChargeRefunded(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  if (!ctx.bookingId) return

  const { data: pre } = await admin
    .from('bookings')
    .select('status')
    .eq('id', ctx.bookingId)
    .maybeSingle()

  await admin
    .from('payments')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      last_webhook_event_id: ctx.stripeEventId,
    })
    .eq('stripe_payment_intent_id', ctx.paymentIntentId)

  await admin
    .from('bookings')
    .update({ status: 'refunded', payment_status: 'refunded' })
    .eq('id', ctx.bookingId)

  if (pre?.status !== 'refunded') {
    await admin.from('booking_status_events').insert({
      booking_id: ctx.bookingId,
      from_status: pre?.status ?? null,
      to_status: 'refunded',
      actor_id: null,
      actor_role: 'system',
      notes: `Stripe webhook: charge.refunded (event_id: ${ctx.stripeEventId})`,
    })
  }
}

async function handleTransferPaid(
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  if (!ctx.transferId) return
  await admin
    .from('payouts')
    .update({ status: 'paid' })
    .eq('stripe_transfer_id', ctx.transferId)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dispatches a Stripe event to its deterministic handler.
 * The webhook HTTP handler must call this after emitting the event to
 * payment_webhook_events and before returning 200.
 *
 * Unrecognised event types are logged and silently skipped.
 */
export async function dispatchPaymentEvent(
  eventType: string,
  ctx: PaymentEventContext,
  admin: SupabaseClient,
): Promise<void> {
  switch (eventType) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(ctx, admin)
    case 'payment_intent.succeeded':
      return handlePaymentCaptured(ctx, admin)
    case 'payment_intent.payment_failed':
      return handlePaymentFailed(ctx, admin)
    case 'payment_intent.canceled':
      return handlePaymentCanceled(ctx, admin)
    case 'charge.refunded':
      return handleChargeRefunded(ctx, admin)
    case 'transfer.paid':
      return handleTransferPaid(ctx, admin)
    default:
      console.info(`[paymentStateMachine] unhandled event type: ${eventType}`)
  }
}
