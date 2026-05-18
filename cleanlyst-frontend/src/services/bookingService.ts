import type { BookingStatus } from '@/types/domain'
import { getSupabaseClient } from '@/services/supabaseClient'

export interface BookingListRow {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  scheduled_end?: string | null
  status: BookingStatus
  created_at: string
  quote_cents: number | null
  cleaner_id?: string | null
  customer?: { id: string; full_name: string; avatar_url: string | null } | null
}

export interface BookingRequestInput {
  customerId: string
  cleanerId: string
  serviceId: string
  serviceTitleSnapshot: string
  categorySnapshot?: string | null
  descriptionSnapshot?: string | null
  locationText: string
  scheduledStart: string
  scheduledEnd: string
  quoteCents: number
  cleanerPayoutCents: number
  currency?: string
  notes?: string | null
}

const BOOKING_LIST_SELECT =
  'id, service_title_snapshot, scheduled_start, scheduled_end, location_text, status, created_at, quote_cents, cleaner_id, customer:profiles!customer_id(id, full_name, avatar_url)'

export async function getMyBookings() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getCustomerBookings(customerId: string): Promise<BookingListRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_LIST_SELECT)
    .eq('customer_id', customerId)
    .order('scheduled_start', { ascending: true })

  if (error) throw error
  return (data ?? []) as BookingListRow[]
}

export async function getCleanerBookings(cleanerId: string): Promise<BookingListRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_LIST_SELECT)
    .eq('cleaner_id', cleanerId)
    .order('scheduled_start', { ascending: true })

  if (error) throw error
  return (data ?? []) as BookingListRow[]
}

export async function getBookingRequestsForCleaner() {
  const supabase = getSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  return getCleanerBookings(user.id)
}

export async function createBookingRequest(input: BookingRequestInput): Promise<{ id: string }> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: input.customerId,
      cleaner_id: input.cleanerId,
      service_id: input.serviceId,
      service_title_snapshot: input.serviceTitleSnapshot,
      category_snapshot: input.categorySnapshot ?? null,
      description_snapshot: input.descriptionSnapshot ?? null,
      location_text: input.locationText,
      scheduled_start: input.scheduledStart,
      scheduled_end: input.scheduledEnd,
      quote_cents: input.quoteCents,
      cleaner_payout_cents: input.cleanerPayoutCents,
      currency: input.currency ?? 'GBP',
      status: 'pending_request',
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data as { id: string }
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

export function cancelBooking(bookingId: string, note?: string) {
  return transitionBookingState(bookingId, 'cancelled', note)
}

export interface BookingDetailRow extends BookingListRow {
  customer_id: string
  scheduled_end: string | null
  started_at?: string | null
  notes: string | null
  estimated_hours: number | null
  cleaner_payout_cents: number | null
  currency?: string | null
  payments?: Array<{ status: string; amount_cents: number | null; captured_at: string | null }>
  customer?: { id: string; full_name: string; avatar_url: string | null }
  booking_financials?: { cleaner_payout_cents: number | null; currency: string | null }
}

export async function getBookingById(bookingId: string): Promise<BookingDetailRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `*,
      customer:profiles!customer_id(id, full_name, avatar_url),
      payments(status, amount_cents, captured_at),
      booking_financials(cleaner_payout_cents, currency)`,
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw error
  return data as BookingDetailRow | null
}

export async function updateBookingDetails(
  bookingId: string,
  updates: { notes?: string | null; estimated_hours?: number | null },
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .update({
      notes: updates.notes ?? null,
      estimated_hours: updates.estimated_hours ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) throw error
  return data as BookingDetailRow
}

export async function completeBooking(bookingId: string) {
  return transitionBookingState(bookingId, 'completed')
}
