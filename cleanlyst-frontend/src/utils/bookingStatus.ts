import type { BookingStatus } from '@/types/domain'

export type BookingDisplayRole = 'customer' | 'cleaner'

export interface BookingDisplayStatus {
  status: BookingStatus | string
  payment_status?: string | null
}

export function isCustomerPaymentRequired(booking: BookingDisplayStatus): boolean {
  return booking.status === 'accepted' && booking.payment_status === 'unpaid'
}

export function getBookingDisplayStatus(
  booking: BookingDisplayStatus,
  role: BookingDisplayRole,
): string {
  if (booking.status === 'accepted' && booking.payment_status === 'unpaid') {
    return role === 'cleaner' ? 'Awaiting Customer Payment' : 'Accepted'
  }

  if (booking.status === 'awaiting_customer_payment') {
    return role === 'cleaner' ? 'Awaiting Customer Payment' : 'Awaiting Payment'
  }

  if (booking.status === 'estimate_proposed') {
    return 'Estimate Proposed'
  }

  const labels: Record<BookingStatus, string> = {
    pending_request: 'Pending Approval',
    accepted: 'Accepted',
    declined: 'Declined',
    paid_pending_start: 'Paid – Awaiting Start',
    scheduled: 'Confirmed & Scheduled',
    estimate_proposed: 'Estimate Proposed',
    awaiting_customer_payment:
      role === 'cleaner' ? 'Awaiting Customer Payment' : 'Awaiting Payment',
    payment_authorized: 'Confirmed',
    in_progress: 'In Progress',
    completion_pending_customer: 'Awaiting Your Confirmation',
    completed: 'Completed',
    cancelled: 'Cancelled',
    cleaner_declined: 'Declined',
    disputed: 'Disputed',
    refunded: 'Refunded',
  }

  return (
    labels[booking.status] ??
    booking.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
