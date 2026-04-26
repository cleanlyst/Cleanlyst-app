import type { BookingStatus } from '@/types/domain'
import { getSupabaseClient } from '@/services/supabaseClient'

export async function getMyBookings() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getBookingRequestsForCleaner() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function transitionBookingState(
  bookingId: string,
  targetStatus: BookingStatus,
  note?: string,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('transition_booking_state', {
    p_booking_id: bookingId,
    p_target_status: targetStatus,
    p_note: note ?? null,
  })

  if (error) throw error
  return data
}
