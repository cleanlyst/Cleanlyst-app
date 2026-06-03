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

// ─── Transition map (mirrors SQL in transition_booking_state) ─────────────────

export type ActorRole = 'customer' | 'cleaner' | 'admin'

interface TransitionRule {
  allowedActors: ActorRole[]
}

export const LIFECYCLE_TRANSITIONS: Partial<
  Record<BookingStatus, Partial<Record<BookingStatus, TransitionRule>>>
> = {
  pending_request: {
    accepted: { allowedActors: ['cleaner', 'admin'] },
    declined: { allowedActors: ['cleaner', 'admin'] },
    cleaner_declined: { allowedActors: ['cleaner', 'admin'] },
    cancelled: { allowedActors: ['customer', 'admin'] },
    estimate_proposed: { allowedActors: ['cleaner'] },
  },
  accepted: {
    paid: { allowedActors: ['admin'] },
    in_progress: { allowedActors: ['cleaner', 'admin'] },
    cancelled: { allowedActors: ['customer', 'admin'] },
  },
  paid: {
    in_progress: { allowedActors: ['cleaner', 'admin'] },
    cancelled: { allowedActors: ['customer', 'admin'] },
  },
  in_progress: {
    completed: { allowedActors: ['cleaner', 'admin'] },
    completion_pending_customer: { allowedActors: ['cleaner', 'admin'] },
    disputed: { allowedActors: ['customer', 'admin'] },
  },
  completed: {
    disputed: { allowedActors: ['customer', 'admin'] },
    payout_released: { allowedActors: ['admin'] },
  },
  disputed: {
    refunded: { allowedActors: ['admin'] },
    completed: { allowedActors: ['admin'] },
  },
  estimate_proposed: {
    awaiting_customer_payment: { allowedActors: ['customer'] },
    cancelled: { allowedActors: ['customer', 'admin'] },
  },
  awaiting_customer_payment: {
    payment_authorized: { allowedActors: ['customer'] },
    cancelled: { allowedActors: ['customer', 'admin'] },
  },
  payment_authorized: {
    in_progress: { allowedActors: ['cleaner', 'admin'] },
  },
  completion_pending_customer: {
    completed: { allowedActors: ['customer', 'admin'] },
    disputed: { allowedActors: ['customer', 'admin'] },
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

export function canStartCleaning(booking: BookingDetailRow): boolean {
  if (!['paid', 'accepted'].includes(booking.status)) return false
  if (booking.payment_status !== 'captured') return false
  if (booking.started_at) return false
  return true
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
  return ['pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment'].includes(
    booking.status,
  )
}

export function cannotAttend(booking: BookingDetailRow): boolean {
  if (!['pending_request', 'accepted', 'paid'].includes(booking.status)) return false
  return !booking.started_at
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
  return _cancelBookingCustomer(bookingId, reason)
}

export async function markCannotAttend(
  bookingId: string,
  reason?: string,
): Promise<BookingDetailRow> {
  return _cleanerCannotAttend(bookingId, reason)
}
