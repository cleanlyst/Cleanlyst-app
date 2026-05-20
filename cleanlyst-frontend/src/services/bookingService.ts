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
  durationMinutes?: number | null
  hourlyRateCents?: number | null
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
      created_at: String(row.created_at ?? ''),
      quote_cents:
        row.quote_cents === null || row.quote_cents === undefined ? null : Number(row.quote_cents),
      cleaner_id:
        row.cleaner_id === null || row.cleaner_id === undefined ? null : String(row.cleaner_id),
      customer: normalizeCustomerRelationship(row.customer),
    }

    acc.push(normalized)
    return acc
  }, [])
}

const BOOKING_LIST_SELECT =
  'id, service_title_snapshot, scheduled_start, scheduled_end, location_text, status, payment_status, created_at, quote_cents, cleaner_id, customer:profiles!customer_id(id, full_name, avatar_url)'

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
      hourly_rate_cents: input.hourlyRateCents ?? null,
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
  paid_at?: string | null
  notes: string | null
  estimated_hours: number | null
  duration_minutes: number | null
  hourly_rate_cents: number | null
  decline_reason?: string | null
  booking_edit_note?: string | null
  cleaner_payout_cents: number | null
  currency?: string | null
  payments?: Array<{ status: string; amount_cents: number | null; captured_at: string | null }>
  customer: { id: string; full_name: string; avatar_url: string | null } | null | undefined
  booking_financials?: { cleaner_payout_cents: number | null; currency: string | null }
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
  const record = raw as Record<string, unknown>
  return {
    cleaner_payout_cents:
      record.cleaner_payout_cents === null || record.cleaner_payout_cents === undefined
        ? null
        : Number(record.cleaner_payout_cents),
    currency:
      record.currency === null || record.currency === undefined ? null : String(record.currency),
  }
}

function normalizeBookingDetailRow(raw: unknown): BookingDetailRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>

  return {
    ...normalizeBookingListRows([row])[0]!,
    customer_id: String(row.customer_id ?? ''),
    scheduled_end:
      row.scheduled_end === null || row.scheduled_end === undefined
        ? null
        : String(row.scheduled_end),
    started_at:
      row.started_at === null || row.started_at === undefined ? null : String(row.started_at),
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
    hourly_rate_cents:
      row.hourly_rate_cents === null || row.hourly_rate_cents === undefined
        ? null
        : Number(row.hourly_rate_cents),
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
      booking_financials(cleaner_payout_cents, currency)`,
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
  const now = new Date().toISOString()

  const current = await getBookingById(bookingId)
  if (!current) throw new Error('Booking not found.')

  const quoteCents = current.quote_cents ?? 0
  const currency = current.currency ?? 'GBP'
  const cleanerPayoutCents = current.cleaner_payout_cents ?? Math.round(quoteCents * 0.93)
  const platformFeeCents = quoteCents - cleanerPayoutCents

  // Upsert payment row
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const paymentFields = {
    booking_id: bookingId,
    status: 'captured',
    amount_cents: quoteCents,
    currency,
    authorized_at: now,
    captured_at: now,
    platform_fee_cents: platformFeeCents,
    cleaner_payout_cents: cleanerPayoutCents,
    metadata: { type: 'dummy_payment', processed: true },
  }

  let paymentId: string | null = existingPayment?.id ?? null

  if (existingPayment?.id) {
    const { error } = await supabase
      .from('payments')
      .update({ ...paymentFields, updated_at: now })
      .eq('booking_id', bookingId)
    if (error) throw error
  } else {
    const { data: newPayment, error } = await supabase
      .from('payments')
      .insert(paymentFields)
      .select('id')
      .single()
    if (error) throw error
    paymentId = newPayment?.id ?? null
  }

  // Upsert booking_financials
  const { error: finError } = await supabase.from('booking_financials').upsert(
    {
      booking_id: bookingId,
      quote_cents: quoteCents,
      platform_fee_cents: platformFeeCents,
      booking_fee_cents: 0,
      cleaner_payout_cents: cleanerPayoutCents,
      currency,
    },
    { onConflict: 'booking_id' },
  )
  if (finError) console.warn('booking_financials upsert failed:', finError)

  // Insert transaction record (skip if already exists)
  if (paymentId) {
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (!existingTx) {
      const { error: txError } = await supabase.from('transactions').insert({
        booking_id: bookingId,
        payment_id: paymentId,
        stripe_payment_intent_id: null,
        amount: quoteCents,
        currency,
        payment_status: 'paid',
      })
      if (txError) console.warn('transactions insert failed:', txError)
    }
  }

  // Mark booking as paid; advance estimate_proposed/awaiting_customer_payment → accepted
  const needsStatusAdvance = ['estimate_proposed', 'awaiting_customer_payment'].includes(
    current.status ?? '',
  )
  const bookingPatch: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: now,
    updated_at: now,
  }
  if (needsStatusAdvance) bookingPatch.status = 'accepted'
  const { error: bookingError } = await supabase
    .from('bookings')
    .update(bookingPatch)
    .eq('id', bookingId)
  if (bookingError) throw bookingError

  // Notify cleaner (non-fatal)
  if (current.cleaner_id) {
    const { error: notifError } = await supabase.rpc('create_notification', {
      p_user_id: current.cleaner_id,
      p_type: 'payment_received',
      p_title: 'Payment received',
      p_body: 'Customer payment has been confirmed. You can now start the job.',
    })
    if (notifError) console.warn('Notification failed:', notifError)
  }

  const updated = await getBookingById(bookingId)
  if (!updated) throw new Error('Payment recorded but failed to fetch updated booking.')
  return updated
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
