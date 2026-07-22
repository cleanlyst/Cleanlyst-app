/**
 * onPaymentCaptured subscriber
 *
 * Called by paymentStateDispatcher when a payment_intent.succeeded event fires.
 * By the time this runs, the backend state machine has already:
 *   - Set payments.status = 'captured'
 *   - Set bookings.payment_status = 'captured'
 *   - Set bookings.status = 'paid' (if was 'payment_authorized')
 *
 * This hook is responsible for FRONTEND reactivity only:
 *   - Refreshing the booking from the confirmed DB state
 *   - Propagating updates to any reactive store or component layer
 *
 * INVARIANT: No direct Supabase table writes here.
 * All booking mutations flow through stripe-webhook → _shared/paymentStateMachine.
 */

import { getSupabaseClient } from '@/services/supabaseClient'

/**
 * Refreshes the booking row after a payment capture event.
 * Returns the refreshed booking data so callers can update their local state.
 *
 * Usage:
 *   const booking = await onPaymentCaptured(bookingId)
 *   if (booking) store.booking = booking
 */
export async function onPaymentCaptured(
  bookingId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, payment_status, paid_at, updated_at, customer_id, cleaner_id',
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('[onPaymentCaptured] failed to refresh booking', { bookingId, error })
    return null
  }

  console.info('[onPaymentCaptured] booking refreshed after capture', {
    bookingId,
    status: data?.status,
    payment_status: data?.payment_status,
  })

  return data
}
