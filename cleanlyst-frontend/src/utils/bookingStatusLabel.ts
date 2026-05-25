export type BookingRole = 'customer' | 'cleaner' | 'admin'

export interface StatusLabelInput {
  status: string
  payment_status?: string | null
  requires_additional_payment?: boolean | null
}

export function getBookingStatusLabel(booking: StatusLabelInput, role: BookingRole = 'customer'): string {
  const { status, payment_status, requires_additional_payment } = booking

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
      return 'Cleaning In Progress'

    case 'completion_pending_customer':
      return role === 'customer' ? 'Confirm Completion' : 'Awaiting Confirmation'

    case 'completed':
      return 'Completed'

    case 'cancelled':
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
      'payment_authorized',
      'paid_pending_start',
      'scheduled',
      'in_progress',
      'completion_pending_customer',
    ].includes(status)
  )
    return 'status-pill--active'
  if (status === 'completed') return 'status-pill--completed'
  if (['cancelled', 'declined', 'cleaner_declined', 'disputed', 'refunded'].includes(status))
    return 'status-pill--cancelled'
  return ''
}
