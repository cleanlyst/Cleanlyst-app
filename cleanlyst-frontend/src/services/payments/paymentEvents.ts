/**
 * Payment Event Contract
 *
 * Defines the canonical event model for all payment lifecycle transitions.
 * Every payment action that crosses a system boundary (UI → orchestrator,
 * orchestrator → Stripe, Stripe → webhook, webhook → DB) MUST be expressible
 * as one of these event types.
 *
 * IMPORTANT — source of truth rule:
 *   - PaymentStarted is emitted by the orchestrator when a payment flow begins
 *   - PaymentSucceeded is emitted by the WEBHOOK ONLY (not the orchestrator)
 *   - PaymentFailed is emitted by the webhook on Stripe failure events
 *   - PaymentRefundRequested is emitted by admin flows before the Edge Function fires
 *
 * These types are used for logging, tracing, and future event-bus integration.
 * They do NOT replace DB state — they complement it.
 */

import type { PaymentProvider, PaymentType } from './types'

// ─────────────────────────────────────────────────────────────────
// BASE EVENT
// ─────────────────────────────────────────────────────────────────

interface BasePaymentEvent {
  /** UUID that groups related events across a full payment lifecycle */
  correlationId: string
  bookingId: string
  paymentType: PaymentType
  provider: PaymentProvider
  /** ISO 8601 timestamp. Always UTC. */
  timestamp: string
}

// ─────────────────────────────────────────────────────────────────
// CONCRETE EVENTS
// ─────────────────────────────────────────────────────────────────

/**
 * Emitted by paymentOrchestrator immediately before dispatching to Stripe
 * or executing a simulation RPC.
 *
 * After this event, the system is "in flight" — UI should show a loading state
 * and the user must not navigate away (Stripe redirect is pending or in progress).
 */
export interface PaymentStarted extends BasePaymentEvent {
  readonly type: 'payment.started'
  /** Present for Stripe Checkout flows — the URL the browser will redirect to */
  redirectUrl?: string
  /** Present for Stripe Elements flows — the client secret for the Payment Element */
  clientSecret?: string
  /** True when simulation path was used (dev/staging without Stripe key) */
  simulationMode: boolean
}

/**
 * Emitted by the webhook handler ONLY after Stripe confirms payment capture.
 * This is the authoritative signal that money has moved.
 *
 * DO NOT emit this from the orchestrator or UI — only the webhook is trusted
 * as a source of truth for payment confirmation.
 *
 * Corresponds to Stripe events: checkout.session.completed, payment_intent.succeeded
 */
export interface PaymentSucceeded extends BasePaymentEvent {
  readonly type: 'payment.succeeded'
  amountCents: number
  currency: 'gbp' | 'GBP'
  /** Stripe event ID for deduplication / tracing */
  stripeEventId: string
  stripePaymentIntentId?: string
}

/**
 * Emitted by the webhook handler when Stripe reports a payment failure.
 * The booking remains in its current state — no transition occurs.
 *
 * The UI should poll booking status or subscribe to a realtime channel
 * to surface this to the user.
 *
 * Corresponds to Stripe event: payment_intent.payment_failed
 */
export interface PaymentFailed extends BasePaymentEvent {
  readonly type: 'payment.failed'
  failureReason?: string
  /** Stripe error code for support lookup */
  stripeErrorCode?: string
  stripeEventId: string
}

/**
 * Emitted by admin flows before the refund-payment Edge Function is called.
 * The actual refund confirmation comes from Stripe's charge.refunded webhook event.
 *
 * partialAmount is undefined for full refunds.
 */
export interface PaymentRefundRequested extends BasePaymentEvent {
  readonly type: 'payment.refund_requested'
  paymentId: string
  partialAmountCents?: number
  requestedByAdminId: string
  reason?: string
}

/**
 * Emitted by the orchestrator after the refund-payment Edge Function confirms success.
 * This signals that a refund has been initiated in Stripe; actual settlement confirmation
 * comes from Stripe's charge.refunded or payment_intent.canceled webhook event.
 */
export interface PaymentRefunded extends BasePaymentEvent {
  readonly type: 'payment.refunded'
  refundId?: string
  amountCents?: number
  reason?: string
  isFullRefund: boolean
}

/** Union of all payment events */
export type PaymentEvent =
  | PaymentStarted
  | PaymentSucceeded
  | PaymentFailed
  | PaymentRefundRequested
  | PaymentRefunded

// ─────────────────────────────────────────────────────────────────
// FACTORY HELPERS
// ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

export function makePaymentStartedEvent(
  params: Omit<PaymentStarted, 'type' | 'correlationId' | 'timestamp'> & {
    correlationId?: string
  },
): PaymentStarted {
  return {
    type: 'payment.started',
    correlationId: params.correlationId ?? uuid(),
    timestamp: now(),
    ...params,
  }
}

export function makePaymentSucceededEvent(
  params: Omit<PaymentSucceeded, 'type' | 'correlationId' | 'timestamp'> & {
    correlationId?: string
  },
): PaymentSucceeded {
  return {
    type: 'payment.succeeded',
    correlationId: params.correlationId ?? uuid(),
    timestamp: now(),
    ...params,
  }
}

export function makePaymentFailedEvent(
  params: Omit<PaymentFailed, 'type' | 'correlationId' | 'timestamp'> & {
    correlationId?: string
  },
): PaymentFailed {
  return {
    type: 'payment.failed',
    correlationId: params.correlationId ?? uuid(),
    timestamp: now(),
    ...params,
  }
}

export function makePaymentRefundRequestedEvent(
  params: Omit<PaymentRefundRequested, 'type' | 'correlationId' | 'timestamp'> & {
    correlationId?: string
  },
): PaymentRefundRequested {
  return {
    type: 'payment.refund_requested',
    correlationId: params.correlationId ?? uuid(),
    timestamp: now(),
    ...params,
  }
}

export function makePaymentRefundedEvent(
  params: Omit<PaymentRefunded, 'type' | 'correlationId' | 'timestamp'> & {
    correlationId?: string
  },
): PaymentRefunded {
  return {
    type: 'payment.refunded',
    correlationId: params.correlationId ?? uuid(),
    timestamp: now(),
    ...params,
  }
}
