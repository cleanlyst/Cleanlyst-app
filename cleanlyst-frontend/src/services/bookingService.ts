import type { BookingStatus } from '@/types/domain'
import { getSupabaseClient } from '@/services/supabaseClient'

export interface BookingListRow {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  scheduled_end?: string | null
  status: BookingStatus
  payment_status?: string | null
  started_at?: string | null
  no_show_reported_at?: string | null
  no_show_action?: string | null
  created_at: string
  quote_cents: number | null
  cleaner_id?: string | null
  requires_additional_payment: boolean
  additional_payment_cents: number | null
  initial_quote_cents: number | null
  customer?: { id: string; full_name: string; avatar_url: string | null } | null
}

export interface BookingFinancialsSnapshot {
  servicePriceCents: number
  bookingFeeCents: number
  cleanerCommissionCents: number
  cleanerPayoutCents: number
  platformRevenueCents: number
  bookingFeePercent: number
  cleanerCommissionPercent: number
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
  durationMinutes?: number | null
  financials?: BookingFinancialsSnapshot | null
}

function normalizeCustomerRelationship(raw: unknown): BookingListRow['customer'] {
  if (!raw) return null

  const customerArray = Array.isArray(raw) ? raw : [raw]
  if (customerArray.length === 0) return null

  const firstCustomer = customerArray[0]
  if (!firstCustomer || typeof firstCustomer !== 'object') return null

  const customerRecord = firstCustomer as Record<string, unknown>
  return {
    id: String(customerRecord.id),
    full_name: String(customerRecord.full_name ?? ''),
    avatar_url:
      customerRecord.avatar_url === null || customerRecord.avatar_url === undefined
        ? null
        : String(customerRecord.avatar_url),
  }
}

function normalizeBookingListRows(data: unknown): BookingListRow[] {
  if (!Array.isArray(data)) return []

  return data.reduce<BookingListRow[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc
    const row = item as Record<string, unknown>
    const normalized: BookingListRow = {
      id: String(row.id),
      service_title_snapshot:
        row.service_title_snapshot === null || row.service_title_snapshot === undefined
          ? null
          : String(row.service_title_snapshot),
      location_text: String(row.location_text ?? ''),
      scheduled_start: String(row.scheduled_start ?? ''),
      scheduled_end:
        row.scheduled_end === null || row.scheduled_end === undefined
          ? null
          : String(row.scheduled_end),
      status: row.status as BookingStatus,
      payment_status:
        row.payment_status === null || row.payment_status === undefined
          ? null
          : String(row.payment_status),
      started_at:
        row.started_at === null || row.started_at === undefined ? null : String(row.started_at),
      no_show_reported_at:
        row.no_show_reported_at === null || row.no_show_reported_at === undefined
          ? null
          : String(row.no_show_reported_at),
      no_show_action:
        row.no_show_action === null || row.no_show_action === undefined
          ? null
          : String(row.no_show_action),
      created_at: String(row.created_at ?? ''),
      quote_cents:
        row.quote_cents === null || row.quote_cents === undefined ? null : Number(row.quote_cents),
      cleaner_id:
        row.cleaner_id === null || row.cleaner_id === undefined ? null : String(row.cleaner_id),
      requires_additional_payment:
        row.requires_additional_payment === true || row.requires_additional_payment === 'true',
      additional_payment_cents:
        row.additional_payment_cents === null || row.additional_payment_cents === undefined
          ? null
          : Number(row.additional_payment_cents),
      initial_quote_cents:
        row.initial_quote_cents === null || row.initial_quote_cents === undefined
          ? null
          : Number(row.initial_quote_cents),
      customer: normalizeCustomerRelationship(row.customer),
    }

    acc.push(normalized)
    return acc
  }, [])
}

const BOOKING_LIST_SELECT =
  'id, service_title_snapshot, scheduled_start, scheduled_end, location_text, status, payment_status, started_at, no_show_reported_at, no_show_action, created_at, quote_cents, cleaner_id, requires_additional_payment, additional_payment_cents, initial_quote_cents, customer:profiles!customer_id(id, full_name, avatar_url)'

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
  return normalizeBookingListRows(data)
}

export async function getCleanerBookings(cleanerId: string): Promise<BookingListRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_LIST_SELECT)
    .eq('cleaner_id', cleanerId)
    .order('scheduled_start', { ascending: true })

  if (error) throw error
  return normalizeBookingListRows(data)
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
      payment_status: 'unpaid',
      duration_minutes: input.durationMinutes ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  const booking = data as { id: string }

  // Persist immutable financial snapshot so admin fee changes never affect past bookings.
  // record_initial_payment (security definer) provides a server-side fallback if this
  // client-side upsert fails for any reason.
  if (input.financials) {
    const f = input.financials
    const { error: finError } = await supabase.from('booking_financials').upsert({
      booking_id: booking.id,
      service_price_cents: f.servicePriceCents,
      booking_fee_cents: f.bookingFeeCents,
      cleaner_commission_cents: f.cleanerCommissionCents,
      cleaner_payout_cents: f.cleanerPayoutCents,
      platform_revenue_cents: f.platformRevenueCents,
      booking_fee_percent: f.bookingFeePercent,
      cleaner_commission_percent: f.cleanerCommissionPercent,
      // legacy columns kept for backward compat
      quote_cents: input.quoteCents,
      platform_fee_cents: f.platformRevenueCents,
      currency: input.currency ?? 'GBP',
    })
    if (finError) {
      // Non-fatal: server-side fallback in record_initial_payment will write the snapshot.
      console.warn('[Pricing] booking_financials client write failed (server will retry):', finError.message)
    } else {
      console.log('[Pricing] booking_financials snapshot written:', {
        bookingId: booking.id,
        servicePriceCents: f.servicePriceCents,
        bookingFeeCents: f.bookingFeeCents,
        commissionCents: f.cleanerCommissionCents,
        cleanerPayoutCents: f.cleanerPayoutCents,
        platformRevenueCents: f.platformRevenueCents,
      })
    }
  }

  return booking
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
  service_id?: string | null
  category_snapshot?: string | null
  scheduled_end: string | null
  started_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
  paid_at?: string | null
  notes: string | null
  estimated_hours: number | null
  duration_minutes: number | null
  decline_reason?: string | null
  booking_edit_note?: string | null
  cleaner_payout_cents: number | null
  currency?: string | null
  requires_additional_payment: boolean
  additional_payment_cents: number | null
  initial_quote_cents: number | null
  payments?: Array<{ status: string; amount_cents: number | null; captured_at: string | null }>
  customer: { id: string; full_name: string; avatar_url: string | null } | null | undefined
  booking_financials?: {
    service_price_cents: number | null
    booking_fee_cents: number | null
    cleaner_commission_cents: number | null
    cleaner_payout_cents: number | null
    platform_revenue_cents: number | null
    booking_fee_percent: number | null
    cleaner_commission_percent: number | null
    currency: string | null
  }
}

function normalizePayments(raw: unknown): BookingDetailRow['payments'] {
  if (!Array.isArray(raw)) return undefined

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((row) => ({
      status: String(row.status ?? ''),
      amount_cents:
        row.amount_cents === null || row.amount_cents === undefined
          ? null
          : Number(row.amount_cents),
      captured_at:
        row.captured_at === null || row.captured_at === undefined ? null : String(row.captured_at),
    }))
}

function normalizeBookingFinancials(
  raw: unknown,
): BookingDetailRow['booking_financials'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const n = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v)
  return {
    service_price_cents: n(r.service_price_cents),
    booking_fee_cents: n(r.booking_fee_cents),
    cleaner_commission_cents: n(r.cleaner_commission_cents),
    cleaner_payout_cents: n(r.cleaner_payout_cents),
    platform_revenue_cents: n(r.platform_revenue_cents),
    booking_fee_percent: n(r.booking_fee_percent),
    cleaner_commission_percent: n(r.cleaner_commission_percent),
    currency: r.currency === null || r.currency === undefined ? null : String(r.currency),
  }
}

function normalizeBookingDetailRow(raw: unknown): BookingDetailRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>

  return {
    ...normalizeBookingListRows([row])[0]!,
    customer_id: String(row.customer_id ?? ''),
    service_id: row.service_id === null || row.service_id === undefined ? null : String(row.service_id),
    category_snapshot:
      row.category_snapshot === null || row.category_snapshot === undefined
        ? null
        : String(row.category_snapshot),
    scheduled_end:
      row.scheduled_end === null || row.scheduled_end === undefined
        ? null
        : String(row.scheduled_end),
    started_at:
      row.started_at === null || row.started_at === undefined ? null : String(row.started_at),
    completed_at:
      row.completed_at === null || row.completed_at === undefined ? null : String(row.completed_at),
    cancelled_at:
      row.cancelled_at === null || row.cancelled_at === undefined ? null : String(row.cancelled_at),
    cancellation_reason:
      row.cancellation_reason === null || row.cancellation_reason === undefined
        ? null
        : String(row.cancellation_reason),
    paid_at:
      row.paid_at === null || row.paid_at === undefined ? null : String(row.paid_at),
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    estimated_hours:
      row.estimated_hours === null || row.estimated_hours === undefined
        ? null
        : Number(row.estimated_hours),
    duration_minutes:
      row.duration_minutes === null || row.duration_minutes === undefined
        ? null
        : Number(row.duration_minutes),
    decline_reason:
      row.decline_reason === null || row.decline_reason === undefined
        ? null
        : String(row.decline_reason),
    booking_edit_note:
      row.booking_edit_note === null || row.booking_edit_note === undefined
        ? null
        : String(row.booking_edit_note),
    cleaner_payout_cents:
      row.cleaner_payout_cents === null || row.cleaner_payout_cents === undefined
        ? null
        : Number(row.cleaner_payout_cents),
    currency: row.currency === null || row.currency === undefined ? null : String(row.currency),
    payments: normalizePayments(row.payments),
    booking_financials: normalizeBookingFinancials(row.booking_financials),
    customer: normalizeCustomerRelationship(row.customer),
  }
}

export async function getBookingById(bookingId: string): Promise<BookingDetailRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `*,
      customer:profiles!customer_id(id, full_name, avatar_url),
      payments(status, amount_cents, captured_at),
      booking_financials(service_price_cents, booking_fee_cents, cleaner_commission_cents, cleaner_payout_cents, platform_revenue_cents, booking_fee_percent, cleaner_commission_percent, currency)`,
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw error
  return normalizeBookingDetailRow(data)
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
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to update booking details.')
  return booking
}

export async function completeBooking(bookingId: string): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('complete_booking', { p_booking_id: bookingId })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to complete booking.')
  console.log('[Booking] Completed:', {
    bookingId,
    cleanerPayoutCents: booking.cleaner_payout_cents,
    quoteCents: booking.quote_cents,
    bookingFinancials: booking.booking_financials,
  })
  return booking
}

export async function startBooking(bookingId: string): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('start_booking', { p_booking_id: bookingId })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to start booking.')
  return booking
}

export async function reportCleanerNoShow(
  bookingId: string,
  action: 'replacement' | 'refund',
): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('report_cleaner_no_show', {
    p_booking_id: bookingId,
    p_action: action,
  })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to update no-show report.')
  return booking
}

export async function updateBookingDuration(
  bookingId: string,
  durationMinutes: number,
): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('update_booking_duration', {
    p_booking_id: bookingId,
    p_duration_minutes: durationMinutes,
  })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to update booking duration.')
  return booking
}

export async function processBookingPayment(bookingId: string): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('process_booking_payment', {
    p_booking_id: bookingId,
  })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to process payment.')
  return booking
}

export async function processPaymentDirect(bookingId: string): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()

  // Simulate payment gateway delay
  await new Promise((resolve) => setTimeout(resolve, 2500))

  const { data: paymentResult, error } = await supabase.rpc('record_initial_payment', {
    p_booking_id: bookingId,
  })

  if (error) throw new Error(error.message ?? 'Payment processing failed')

  const pr = paymentResult as { quote_cents?: number; payment_status?: string } | null
  console.log('[Payment] record_initial_payment completed:', {
    bookingId,
    amountCents: pr?.quote_cents,
    paymentStatus: pr?.payment_status,
  })

  const updated = await getBookingById(bookingId)
  if (!updated) throw new Error('Payment recorded but failed to fetch updated booking.')
  return updated
}

export async function recordAdditionalPayment(bookingId: string): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()

  // Simulate payment gateway delay
  await new Promise((resolve) => setTimeout(resolve, 2500))

  const { error } = await supabase.rpc('record_additional_payment', {
    p_booking_id: bookingId,
  })

  if (error) throw new Error(error.message ?? 'Additional payment processing failed')

  const updated = await getBookingById(bookingId)
  if (!updated) throw new Error('Payment recorded but failed to fetch updated booking.')
  return updated
}

export async function reassignBooking(
  bookingId: string,
  newCleanerId: string,
  note?: string,
): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('reassign_booking', {
    p_booking_id: bookingId,
    p_new_cleaner_id: newCleanerId,
    p_note: note ?? null,
  })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to reassign booking.')
  return booking
}

export async function proposeEstimate(
  bookingId: string,
  quoteCents: number,
  note?: string,
): Promise<BookingDetailRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('propose_estimate', {
    p_booking_id: bookingId,
    p_quote_cents: quoteCents,
    p_note: note ?? null,
  })
  if (error) throw error
  const booking = normalizeBookingDetailRow(data)
  if (!booking) throw new Error('Failed to propose estimate.')
  return booking
}
