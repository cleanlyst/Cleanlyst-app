/**
 * bookingLifecycleService — single entry point for all booking state mutations.
 *
 * EPIC 4 rule: components must never call transitionBookingState or mutate
 * booking status directly. All state changes go through this service.
 *
 * Canonical lifecycle:
 *   pending_request → accepted → paid → in_progress → completed → (payout_released audit event)
 *
 * Alternate paths:
 *   pending_request → declined / cancelled
 *   accepted / paid → cancelled (customer)
 *   pending_request / accepted / paid → cleaner_cancelled (cleaner cannot attend)
 *   completed → disputed
 */

import type { BookingStatus } from '@/types/domain'
import type { BookingDetailRow } from '@/services/bookingService'
import {
  transitionBookingState,
  startBooking as _startBooking,
  completeBooking as _completeBooking,
  cancelBookingCustomer as _cancelBookingCustomer,
  cleanerCannotAttend as _cleanerCannotAttend,
} from '@/services/bookingService'
import { derivePaymentReadiness } from '@/services/payments/paymentStateMachine'
import type { DerivedPaymentState } from '@/services/payments/paymentLedgerResolver'
import { refundPayment } from '@/services/payments/paymentOrchestrator'

// ─── Transition map (mirrors SQL in transition_booking_state) ─────────────────

export type ActorRole = 'customer' | 'cleaner' | 'admin'

interface TransitionRule {
  allowedActors: ActorRole[]
}

// Deterministic contract: ALL bookings.status transitions must flow through
// the transition_booking_state RPC. This map is the single source of truth
// for what is allowed — it mirrors the if-elsif chain in that RPC exactly.
// service_role (Stripe webhook) is the only writer outside this contract;
// it may write payment_authorized and refunded without calling this RPC.
export const LIFECYCLE_TRANSITIONS: Partial<
  Record<BookingStatus, Partial<Record<BookingStatus, TransitionRule>>>
> = {
  // pay-before-accept: cleaner can no longer accept/decline from pending_request.
  // Admin retains the ability to decline/cancel unpaid bookings (fraud/admin ops).
  pending_request: {
    declined:          { allowedActors: ['admin'] },
    cancelled:         { allowedActors: ['customer', 'admin'] },
    estimate_proposed: { allowedActors: ['cleaner'] },
    cleaner_cancelled: { allowedActors: ['admin'] },
  },
  // Canonical pay-before-accept path: cleaner accepts AFTER the customer has paid.
  payment_authorized: {
    accepted:          { allowedActors: ['cleaner', 'admin'] },
    cleaner_declined:  { allowedActors: ['cleaner', 'admin'] },
    cancelled:         { allowedActors: ['customer', 'admin'] },
    cleaner_cancelled: { allowedActors: ['cleaner', 'admin'] },
    in_progress:       { allowedActors: ['admin'] }, // admin fast-track only
    refunded:          { allowedActors: ['admin'] },
  },
  accepted: {
    paid:              { allowedActors: ['admin'] },
    in_progress:       { allowedActors: ['cleaner', 'admin'] },
    cancelled:         { allowedActors: ['customer', 'admin'] },
    cleaner_cancelled: { allowedActors: ['cleaner', 'admin'] },
    cleaner_no_show:   { allowedActors: ['customer', 'admin'] },
    refunded:          { allowedActors: ['admin'] },
  },
  paid: {
    in_progress:       { allowedActors: ['cleaner', 'admin'] },
    cancelled:         { allowedActors: ['customer', 'admin'] },
    cleaner_cancelled: { allowedActors: ['cleaner', 'admin'] },
    cleaner_no_show:   { allowedActors: ['customer', 'admin'] },
    refunded:          { allowedActors: ['admin'] },
  },
  in_progress: {
    completed:                  { allowedActors: ['cleaner', 'admin'] },
    completion_pending_customer: { allowedActors: ['cleaner', 'admin'] },
    disputed:                   { allowedActors: ['customer', 'admin'] },
    refunded:                   { allowedActors: ['admin'] },
  },
  completed: {
    disputed: { allowedActors: ['customer', 'admin'] },
    refunded: { allowedActors: ['admin'] },
    // payout_released is an audit-event label only — not a real bookings.status value.
  },
  disputed: {
    refunded:  { allowedActors: ['admin'] },
    completed: { allowedActors: ['admin'] },
  },
  estimate_proposed: {
    awaiting_customer_payment: { allowedActors: ['customer'] },
    cancelled:                 { allowedActors: ['customer', 'admin'] },
  },
  awaiting_customer_payment: {
    // payment_authorized is written by the Stripe webhook (service_role), not this RPC.
    payment_authorized: { allowedActors: ['customer'] },
    cancelled:          { allowedActors: ['customer', 'admin'] },
  },
  completion_pending_customer: {
    completed: { allowedActors: ['customer', 'admin'] },
    disputed:  { allowedActors: ['customer', 'admin'] },
  },
  cleaner_no_show: {
    // Customer or admin picks replacement cleaner → accepted via reassign functions.
    accepted:  { allowedActors: ['customer', 'admin'] },
    cancelled: { allowedActors: ['customer', 'admin'] },
    refunded:  { allowedActors: ['admin'] },
  },
  cleaner_cancelled: {
    // Customer or admin picks replacement cleaner.
    accepted: { allowedActors: ['customer', 'admin'] },
    refunded: { allowedActors: ['admin'] },
  },
  reassign_requested: {
    accepted: { allowedActors: ['customer', 'admin'] },
  },
  cancelled: {
    refunded: { allowedActors: ['admin'] },
  },
}

export function isTransitionAllowed(
  from: BookingStatus,
  to: BookingStatus,
  actorRole: ActorRole,
): boolean {
  const rule = LIFECYCLE_TRANSITIONS[from]?.[to]
  return rule?.allowedActors.includes(actorRole) ?? false
}

// ─── State predicates ─────────────────────────────────────────────────────────

const START_WINDOW_MINUTES = 60

export function canStartCleaning(
  booking: BookingDetailRow,
  derivedPaymentState?: DerivedPaymentState,
): boolean {
  if (booking.started_at) return false
  // pay-before-accept: start requires explicit acceptance first — never from payment_authorized
  if (!['paid', 'accepted'].includes(booking.status)) return false
  // Stripe authorized hold is sufficient to start cleaning; capture happens at payout time.
  if (booking.payment_status === 'authorized' || booking.payment_status === 'captured') return true
  // Prefer ledger-derived state when available; fall back to cached booking field.
  if (derivedPaymentState !== undefined) return derivedPaymentState === 'captured'
  return derivePaymentReadiness(booking.payment_status)
}

export function isWithinStartWindow(booking: BookingDetailRow): boolean {
  if (!canStartCleaning(booking)) return false
  const start = new Date(booking.scheduled_start)
  return Date.now() >= start.getTime() - START_WINDOW_MINUTES * 60 * 1000
}

export function canComplete(booking: BookingDetailRow): boolean {
  return booking.status === 'in_progress'
}

export function canCancelCustomer(booking: BookingDetailRow): boolean {
  return ['pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment', 'payment_authorized'].includes(
    booking.status,
  )
}

export function cannotAttend(booking: BookingDetailRow): boolean {
  // pay-before-accept: cleaners can report cannot-attend only after payment confirmation
  if (!['payment_authorized', 'accepted', 'paid'].includes(booking.status)) return false
  return !booking.started_at
}

/**
 * Mirrors cancel_booking_customer's SQL threshold: cancellations made more
 * than 24 hours before the scheduled start are auto-refund-eligible; later
 * cancellations require admin review. Used by cancelAsCustomer to decide
 * whether to follow up with a real Stripe refund after cancelling — the
 * RPC itself no longer touches payment state (see 20260724000000 migration).
 */
export function isAutoRefundEligible(scheduledStart: string): boolean {
  const start = new Date(scheduledStart).getTime()
  return start - Date.now() > 24 * 60 * 60 * 1000
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function acceptBooking(bookingId: string, note?: string): Promise<BookingDetailRow> {
  return transitionBookingState(bookingId, 'accepted', note)
}

export async function declineBooking(bookingId: string, note?: string): Promise<BookingDetailRow> {
  return transitionBookingState(bookingId, 'declined', note)
}

export async function startCleaning(bookingId: string): Promise<BookingDetailRow> {
  return _startBooking(bookingId)
}

export async function completeCleaning(bookingId: string): Promise<BookingDetailRow> {
  return _completeBooking(bookingId)
}

export async function cancelAsCustomer(
  bookingId: string,
  reason?: string,
): Promise<BookingDetailRow> {
  const booking = await _cancelBookingCustomer(bookingId, reason)

  // cancel_booking_customer only transitions the booking — it no longer
  // touches payment state (see 20260724000000 migration). When the
  // cancellation is auto-refund-eligible (>24h before start), this is the
  // one and only place that triggers the real Stripe refund. Cancellations
  // within 24h intentionally do NOT auto-refund — they await admin review,
  // matching the RPC's own notification to the customer and admins.
  if (isAutoRefundEligible(booking.scheduled_start)) {
    await refundPayment(bookingId, { reason: 'requested_by_customer' })
  }

  return booking
}

export async function markCannotAttend(
  bookingId: string,
  reason?: string,
): Promise<BookingDetailRow> {
  return _cleanerCannotAttend(bookingId, reason)
}
