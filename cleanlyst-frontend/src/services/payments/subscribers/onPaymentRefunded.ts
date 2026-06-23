/**
 * onPaymentRefunded subscriber
 *
 * Called by paymentStateDispatcher when a charge.refunded or
 * payment_intent.canceled event fires.
 *
 * By the time this runs, the backend state machine has already:
 *   - Set payments.status = 'refunded'
 *   - Set bookings.payment_status = 'refunded'
 *   - Set bookings.status = 'refunded' (for charge.refunded / captured payments)
 *   OR
 *   - Set bookings.payment_status = 'refunded' only (for payment_intent.canceled —
 *     bookings.status was already 'refunded' from the refund-payment EF)
 *
 * INVARIANT: No direct Supabase table writes here.
 * All booking mutations flow through stripe-webhook → _shared/paymentStateMachine.
 */

import { getSupabaseClient } from '@/services/supabaseClient'

/**
 * Refreshes the booking row after a refund event.
 * Returns the refreshed booking data so callers can update their local state.
 *
 * Usage:
 *   const booking = await onPaymentRefunded(bookingId)
 *   if (booking) store.booking = booking
 */
export async function onPaymentRefunded(
  bookingId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, payment_status, cancelled_at, cancellation_reason, updated_at, customer_id, cleaner_id',
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('[onPaymentRefunded] failed to refresh booking', { bookingId, error })
    return null
  }

  console.info('[onPaymentRefunded] booking refreshed after refund', {
    bookingId,
    status: data?.status,
    payment_status: data?.payment_status,
  })

  return data
}
