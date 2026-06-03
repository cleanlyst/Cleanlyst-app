import type { BookingStatus } from '@/types/domain'

export type BookingDisplayRole = 'customer' | 'cleaner'

export interface BookingDisplayStatus {
  status: BookingStatus | string
  payment_status?: string | null
  requires_additional_payment?: boolean | null
}

export function isCustomerPaymentRequired(booking: BookingDisplayStatus): boolean {
  return !!booking.requires_additional_payment
}

export function getBookingDisplayStatus(
  booking: BookingDisplayStatus,
  role: BookingDisplayRole,
): string {
  // Upfront payment: pending_request + paid means cleaner needs to accept
  if (booking.status === 'pending_request' && booking.payment_status === 'captured') {
    return role === 'cleaner' ? 'Customer Paid – Pending Approval' : 'Pending Approval'
  }

  if (booking.status === 'accepted' && booking.payment_status === 'captured') {
    return role === 'cleaner' ? 'Ready to Start' : 'Confirmed'
  }

  // Legacy: accepted + unpaid (should not occur in new flow but kept for safety)
  if (booking.status === 'accepted' && booking.payment_status === 'unpaid') {
    return role === 'cleaner' ? 'Awaiting Customer Payment' : 'Accepted'
  }

  if (booking.status === 'awaiting_customer_payment') {
    return role === 'cleaner' ? 'Awaiting Customer Payment' : 'Awaiting Payment'
  }

  if (booking.status === 'estimate_proposed') {
    if (booking.requires_additional_payment) {
      return role === 'customer' ? 'Quote Revised – Payment Required' : 'Awaiting Additional Payment'
    }
    return role === 'customer' ? 'Quote Received' : 'Estimate Proposed'
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
    cleaner_no_show:
      role === 'cleaner' ? 'Booking marked as no-show' : 'Replacement cleaner requested',
    disputed: 'Disputed',
    refunded: 'Refunded',
    paid: role === 'cleaner' ? 'Ready to Start' : 'Confirmed & Paid',
    payout_released: 'Payout Released',
    cleaner_cancelled: role === 'customer' ? 'Cleaner Unavailable' : 'Cancelled',
  }

  return (
    labels[booking.status as BookingStatus] ??
    booking.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
