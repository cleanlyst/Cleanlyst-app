import type { BookingStatus } from '@/types/domain'

const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
  // EPIC 4 canonical path
  pending_request: ['accepted', 'declined', 'cleaner_declined', 'cancelled', 'estimate_proposed'],
  accepted: ['paid', 'in_progress', 'cancelled'],
  paid: ['in_progress', 'cancelled', 'cleaner_cancelled'],
  in_progress: ['completion_pending_customer', 'disputed'],
  completed: ['disputed', 'payout_released'],
  payout_released: [],

  // Alternate / legacy paths
  estimate_proposed: ['awaiting_customer_payment', 'cancelled'],
  awaiting_customer_payment: ['payment_authorized', 'cancelled'],
  payment_authorized: ['in_progress'],
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
