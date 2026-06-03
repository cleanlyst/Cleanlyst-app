export type BookingRole = 'customer' | 'cleaner' | 'admin'

export interface StatusLabelInput {
  status: string
  payment_status?: string | null
  requires_additional_payment?: boolean | null
  no_show_action?: string | null
}

export function getBookingStatusLabel(booking: StatusLabelInput, role: BookingRole = 'customer'): string {
  const { status, payment_status, requires_additional_payment, no_show_action } = booking

  switch (status) {
    case 'pending_request':
      if (role === 'cleaner' && payment_status === 'captured') return 'Pending – Paid'
      return 'Pending'

    case 'accepted':
      return 'Accepted'

    case 'estimate_proposed':
      if (requires_additional_payment) {
        return role === 'customer' ? 'Payment Required' : 'Awaiting Additional Payment'
      }
      return role === 'customer' ? 'Quote Received' : 'Estimate Proposed'

    case 'awaiting_customer_payment':
      return role === 'cleaner' ? 'Awaiting Payment' : 'Awaiting Payment'

    case 'payment_authorized':
    case 'paid_pending_start':
      return 'Confirmed'

    case 'scheduled':
      return 'Scheduled'

    case 'in_progress':
      return role === 'customer' ? 'Cleaner has started cleaning' : 'Cleaning in progress'

    case 'paid':
      return role === 'customer' ? 'Confirmed & Paid' : role === 'cleaner' ? 'Ready to Start' : 'Paid'

    case 'payout_released':
      return 'Payout Released'

    case 'cleaner_cancelled':
      return role === 'customer' ? 'Cleaner Unavailable' : role === 'admin' ? 'Cleaner Cancelled' : 'You Cancelled'

    case 'cleaner_no_show':
      if (role === 'cleaner') return 'Booking marked as no-show'
      if (role === 'admin') return 'Cleaner no-show'
      return 'Replacement cleaner requested'

    case 'completion_pending_customer':
      return role === 'customer' ? 'Confirm Completion' : 'Awaiting Confirmation'

    case 'completed':
      return 'Completed'

    case 'cancelled':
      if (no_show_action === 'refund_requested') return 'Refunded'
      return 'Cancelled'

    case 'declined':
    case 'cleaner_declined':
      return 'Declined'

    case 'disputed':
      return 'Disputed'

    case 'refunded':
      return 'Refunded'

    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

export function getStatusPillClass(status: string): string {
  if (['pending_request', 'estimate_proposed', 'awaiting_customer_payment'].includes(status))
    return 'status-pill--pending'
  if (
    [
      'accepted',
      'paid',
      'payment_authorized',
      'paid_pending_start',
      'scheduled',
      'in_progress',
      'completion_pending_customer',
      'cleaner_no_show',
    ].includes(status)
  )
    return 'status-pill--active'
  if (['completed', 'payout_released'].includes(status)) return 'status-pill--completed'
  if (['cancelled', 'declined', 'cleaner_declined', 'cleaner_cancelled', 'disputed', 'refunded'].includes(status))
    return 'status-pill--cancelled'
  return ''
}
