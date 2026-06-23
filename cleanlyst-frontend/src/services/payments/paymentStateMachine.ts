/**
 * Frontend Payment State Machine — PURE MODULE
 *
 * Deterministic mapping from (paymentEvent × currentBookingStatus) → target state.
 *
 * RULES:
 *   - No API calls, no Supabase imports, no side effects of any kind
 *   - All inputs are plain values; all outputs are plain objects
 *   - Mirrors the backend state machine in _shared/paymentStateMachine.ts
 *   - Used by paymentStateDispatcher (routing), bookingLifecycleService (display),
 *     and unit tests
 *
 * SOURCE OF TRUTH: bookings.payment_status is written exclusively by the
 * Stripe webhook → backend paymentStateMachine. This module is for UI derivation
 * only — it never initiates DB mutations.
 */

import type { BookingStatus } from '@/types/domain'

// ─── Payment Event Types ───────────────────────────────────────────────────────

/**
 * Canonical payment event types recognised by this state machine.
 * Maps from Stripe event types via STRIPE_TO_PAYMENT_EVENT in paymentStateDispatcher.
 */
export type PaymentEventType =
  | 'PaymentStarted'
  | 'PaymentAuthorized'
  | 'PaymentCaptured'
  | 'PaymentRefunded'
  | 'PayoutReleased'

/** Canonical payment status values (mirrors bookings.payment_status check constraint) */
export type PaymentStatusValue = 'unpaid' | 'authorized' | 'captured' | 'refunded'

// ─── State Machine I/O ────────────────────────────────────────────────────────

export interface PaymentStateMachineInput {
  eventType: PaymentEventType
  currentBookingStatus: BookingStatus
}

export interface PaymentStateMachineOutput {
  /** Booking status the system SHOULD be in after this event. null = no change. */
  targetBookingStatus: BookingStatus | null
  /** Payment status the system SHOULD be in after this event. null = no change. */
  targetPaymentStatus: PaymentStatusValue | null
  /** Whether a booking lifecycle transition is needed */
  action: 'transition' | 'noop'
  reason: string
}

// ─── Terminal status classification ───────────────────────────────────────────

/**
 * Statuses where a refund produces 'refunded' (post-service) rather than
 * 'cancelled' (pre-service). Mirrors the backend handler's classification.
 */
const POST_SERVICE_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'in_progress',
  'completed',
  'disputed',
  'completion_pending_customer',
])

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Core state machine function. Pure and deterministic.
 *
 * Always call this to derive expected state from a payment event.
 * Never use booking.payment_status directly in business/display logic.
 */
export function handle(input: PaymentStateMachineInput): PaymentStateMachineOutput {
  const { eventType, currentBookingStatus } = input

  switch (eventType) {
    case 'PaymentStarted':
      // Orchestrator emits this when a payment flow begins.
      // No booking state change until Stripe confirms.
      return {
        targetBookingStatus: null,
        targetPaymentStatus: null,
        action: 'noop',
        reason: 'Payment flow initiated — awaiting Stripe confirmation',
      }

    case 'PaymentAuthorized':
      // checkout.session.completed — Stripe holds the payment.
      return {
        targetBookingStatus: 'payment_authorized',
        targetPaymentStatus: 'authorized',
        action: 'transition',
        reason: 'Stripe PaymentIntent authorized (capture_method: manual — payment held)',
      }

    case 'PaymentCaptured':
      // payment_intent.succeeded — Stripe captured the hold.
      // Booking transitions to 'paid' only if currently in payment_authorized.
      // If the booking is already past that (in_progress, completed, etc.), no status change.
      return {
        targetBookingStatus: currentBookingStatus === 'payment_authorized' ? 'paid' : null,
        targetPaymentStatus: 'captured',
        action: currentBookingStatus === 'payment_authorized' ? 'transition' : 'noop',
        reason:
          currentBookingStatus === 'payment_authorized'
            ? 'Stripe payment captured — booking transitions to paid'
            : 'Stripe payment captured — booking already past payment_authorized, no status change',
      }

    case 'PaymentRefunded': {
      // charge.refunded or payment_intent.canceled.
      // Pre-service cancellations → 'cancelled'; post-service refunds → 'refunded'.
      const isPostService = POST_SERVICE_STATUSES.has(currentBookingStatus)
      return {
        targetBookingStatus: isPostService ? 'refunded' : 'cancelled',
        targetPaymentStatus: 'refunded',
        action: 'transition',
        reason: isPostService
          ? 'Refund issued after service delivery — booking status: refunded'
          : 'Refund issued before service — booking status: cancelled',
      }
    }

    case 'PayoutReleased':
      // transfer.paid — funds settled to cleaner's account.
      // Booking is already 'completed' — payout state lives in the payouts table.
      return {
        targetBookingStatus: null,
        targetPaymentStatus: null,
        action: 'noop',
        reason: 'Payout settled to cleaner — payout state tracked in payouts table, no booking status change',
      }

    default: {
      const _exhaustiveCheck: never = eventType
      return {
        targetBookingStatus: null,
        targetPaymentStatus: null,
        action: 'noop',
        reason: `Unknown payment event type: ${_exhaustiveCheck as string}`,
      }
    }
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Derives whether payment is in a state that allows the cleaner to start work.
 * Used by bookingLifecycleService.canStartCleaning — replaces direct payment_status reads.
 */
export function derivePaymentReadiness(
  paymentStatus: string | null | undefined,
): boolean {
  return paymentStatus === 'captured'
}

/**
 * Returns a human-readable label for a payment status value.
 * Display-only — never use this for business logic.
 */
export function paymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'unpaid':     return 'Unpaid'
    case 'authorized': return 'Payment held'
    case 'captured':   return 'Payment received'
    case 'refunded':   return 'Refunded'
    default:           return 'Unknown'
  }
}
