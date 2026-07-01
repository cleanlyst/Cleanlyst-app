import type { BookingStatus } from '@/types/domain'

const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
  // pay-before-accept canonical path:
  // pending_request → (estimate flow) or customer cancels
  // payment_authorized → cleaner accepts → in_progress → completed
  pending_request: ['declined', 'cancelled', 'estimate_proposed'],
  payment_authorized: ['accepted', 'cleaner_declined', 'cancelled', 'cleaner_cancelled', 'in_progress'],
  accepted: ['paid', 'in_progress', 'cancelled', 'cleaner_cancelled'],
  paid: ['in_progress', 'cancelled', 'cleaner_cancelled'],
  in_progress: ['completion_pending_customer', 'disputed'],
  completed: ['disputed', 'payout_released'],
  payout_released: [],

  // Estimate flow paths
  estimate_proposed: ['awaiting_customer_payment', 'cancelled'],
  awaiting_customer_payment: ['payment_authorized', 'cancelled'],
  paid_pending_start: ['in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  completion_pending_customer: ['completed', 'disputed'],

  // Terminal states
  declined: [],
  cleaner_declined: [],
  cancelled: [],
  cleaner_cancelled: [],
  disputed: ['refunded', 'completed'],
  refunded: [],
  cleaner_no_show: ['cancelled'],
}

export function useBookingStateMachine() {
  function canTransition(from: BookingStatus, to: BookingStatus): boolean {
    return (transitions[from] ?? []).includes(to)
  }

  function nextStatuses(from: BookingStatus): BookingStatus[] {
    return transitions[from] ?? []
  }

  return { canTransition, nextStatuses }
}
