import type { BookingStatus } from '@/types/domain'

const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending_request: ['estimate_proposed', 'cleaner_declined', 'cancelled'],
  estimate_proposed: ['awaiting_customer_payment', 'cancelled'],
  awaiting_customer_payment: ['payment_authorized', 'cancelled'],
  payment_authorized: ['in_progress'],
  in_progress: ['completion_pending_customer'],
  completion_pending_customer: ['completed', 'disputed'],
  disputed: ['refunded', 'completed'],
  completed: [],
  refunded: [],
  cleaner_declined: [],
  cancelled: [],
}

export function useBookingStateMachine() {
  function canTransition(from: BookingStatus, to: BookingStatus) {
    return transitions[from].includes(to)
  }

  function nextStatuses(from: BookingStatus) {
    return transitions[from]
  }

  return {
    canTransition,
    nextStatuses,
  }
}
