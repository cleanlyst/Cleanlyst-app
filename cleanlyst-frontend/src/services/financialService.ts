/**
 * financialService — single source of truth for financial reporting queries.
 *
 * All monetary values computed here come from booking_financials (immutable
 * snapshot written at booking creation by pricingEngine). Never re-derive
 * totals from live platform_settings — use the snapshot.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { formatPence } from '@/utils/format'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminFinancialMetrics {
  revenueYtdPence: number
  revenueYtdCount: number
  platformFeeYtdPence: number
  pendingPayoutPence: number
  pendingPayoutCleaners: number
}

export interface AdminTransactionRow {
  paymentId: string
  bookingId: string
  amountCents: number
  paymentStatus: string
  createdAt: string
  // enriched from join
  bookingStatus: string | null
  serviceTitle: string | null
  completedAt: string | null
  customerName: string | null
  cleanerName: string | null
  bookingFeeCents: number
  commissionCents: number
  cleanerPayoutCents: number
  servicePriceCents: number
}

export interface CleanerTransactionRow {
  bookingId: string
  serviceTitle: string | null
  scheduledStart: string
  completedAt: string | null
  bookingStatus: string
  paymentStatus: string | null
  cleanerPayoutCents: number | null
  servicePriceCents: number | null
  commissionCents: number | null
  customerName: string | null
}

// ─── Admin metrics ────────────────────────────────────────────────────────────

export async function getAdminFinancialMetrics(ytdStart: string): Promise<AdminFinancialMetrics> {
  const supabase = getSupabaseClient()

  const [revenueRes, feesRes, pendingRes] = await Promise.all([
    // Total Revenue YTD = SUM(booking_financials.quote_cents) for completed bookings.
    // Query from bookings so the .eq/.gte filters apply to the parent row (PostgREST
    // embedded-join filters only filter the nested object, not the parent row).
    supabase
      .from('bookings')
      .select('booking_financials(quote_cents)')
      .eq('status', 'completed')
      .gte('completed_at', ytdStart),

    // Platform Fees YTD = SUM(booking_fee + commission) for completed bookings
    supabase
      .from('bookings')
      .select('booking_financials(booking_fee_cents, cleaner_commission_cents)')
      .eq('status', 'completed')
      .gte('completed_at', ytdStart),

    // Pending Payouts = money collected from customers but not yet paid out to cleaners.
    // complete_booking immediately marks payouts as 'released', so we query bookings
    // where payment is captured but the job is not yet finished.
    supabase
      .from('bookings')
      .select('cleaner_payout_cents, cleaner_id')
      .eq('payment_status', 'captured')
      .in('status', ['accepted', 'in_progress', 'completion_pending_customer']),
  ])

  if (revenueRes.error) throw revenueRes.error
  if (feesRes.error) throw feesRes.error
  if (pendingRes.error) throw pendingRes.error

  const revenueRows = (revenueRes.data ?? []) as Array<{
    booking_financials:
      | { quote_cents: number | null }
      | Array<{ quote_cents: number | null }>
      | null
  }>
  const revenueYtdPence = revenueRows.reduce((s, row) => {
    const bf = Array.isArray(row.booking_financials)
      ? row.booking_financials[0]
      : row.booking_financials
    return s + (bf?.quote_cents ?? 0)
  }, 0)
  const revenueYtdCount = revenueRows.length

  const bookings = (feesRes.data ?? []) as Array<{
    booking_financials:
      | { booking_fee_cents: number | null; cleaner_commission_cents: number | null }
      | Array<{ booking_fee_cents: number | null; cleaner_commission_cents: number | null }>
      | null
  }>
  const platformFeeYtdPence = bookings.reduce((s, row) => {
    const bf = Array.isArray(row.booking_financials)
      ? row.booking_financials[0]
      : row.booking_financials
    return s + (bf?.booking_fee_cents ?? 0) + (bf?.cleaner_commission_cents ?? 0)
  }, 0)

  const pending = (pendingRes.data ?? []) as { cleaner_payout_cents: number | null; cleaner_id: string }[]
  const pendingPayoutPence = pending.reduce((s, r) => s + (r.cleaner_payout_cents ?? 0), 0)
  const uniqueCleaners = new Set(pending.map((p) => p.cleaner_id))

  console.log('[AdminMetrics]', { revenueYtdPence, revenueYtdCount, platformFeeYtdPence, pendingPayoutPence })

  return {
    revenueYtdPence,
    revenueYtdCount,
    platformFeeYtdPence,
    pendingPayoutPence,
    pendingPayoutCleaners: uniqueCleaners.size,
  }
}

// ─── Admin transaction list ───────────────────────────────────────────────────

export async function getAdminTransactions(limit = 10): Promise<AdminTransactionRow[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('payments')
    .select(
      `id, booking_id, amount_cents, status, created_at,
       booking:bookings!booking_id(
         id, status, service_title_snapshot, completed_at, payment_status,
         customer:profiles!customer_id(full_name),
         cleaner:profiles!cleaner_id(full_name),
         booking_financials(
           service_price_cents, booking_fee_cents,
           cleaner_commission_cents, cleaner_payout_cents, quote_cents
         )
       )`,
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return ((data ?? []) as unknown[]).map((raw): AdminTransactionRow => {
    const row = raw as Record<string, unknown>
    const booking = (
      Array.isArray(row.booking) ? row.booking[0] : row.booking
    ) as Record<string, unknown> | null

    const bf_raw = booking?.booking_financials
    const bf = (Array.isArray(bf_raw) ? bf_raw[0] : bf_raw) as Record<string, unknown> | null
    const customer = (
      Array.isArray(booking?.customer) ? (booking?.customer as unknown[])[0] : booking?.customer
    ) as Record<string, unknown> | null
    const cleaner = (
      Array.isArray(booking?.cleaner) ? (booking?.cleaner as unknown[])[0] : booking?.cleaner
    ) as Record<string, unknown> | null

    return {
      paymentId: String(row.id ?? ''),
      bookingId: String(row.booking_id ?? booking?.id ?? ''),
      amountCents: Number(row.amount_cents ?? 0),
      paymentStatus: String(row.status ?? ''),
      createdAt: String(row.created_at ?? ''),
      bookingStatus: booking ? String(booking.status ?? '') : null,
      serviceTitle: booking?.service_title_snapshot
        ? String(booking.service_title_snapshot)
        : null,
      completedAt: booking?.completed_at ? String(booking.completed_at) : null,
      customerName: customer?.full_name ? String(customer.full_name) : null,
      cleanerName: cleaner?.full_name ? String(cleaner.full_name) : null,
      bookingFeeCents: Number(bf?.booking_fee_cents ?? 0),
      commissionCents: Number(bf?.cleaner_commission_cents ?? 0),
      cleanerPayoutCents: Number(bf?.cleaner_payout_cents ?? 0),
      servicePriceCents: Number(bf?.service_price_cents ?? 0),
    }
  })
}

// ─── Cleaner transaction list ─────────────────────────────────────────────────

export async function getCleanerTransactions(
  cleanerId: string,
  limit = 10,
): Promise<CleanerTransactionRow[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, service_title_snapshot, scheduled_start, completed_at,
       status, payment_status, cleaner_payout_cents,
       customer:profiles!customer_id(full_name),
       booking_financials(service_price_cents, cleaner_commission_cents, cleaner_payout_cents)`,
    )
    .eq('cleaner_id', cleanerId)
    .in('status', ['completed', 'payment_authorized', 'in_progress', 'awaiting_customer_payment'])
    .order('scheduled_start', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = ((data ?? []) as unknown[]).map((raw): CleanerTransactionRow => {
    const row = raw as Record<string, unknown>
    const bf_raw = row.booking_financials
    const bf = (Array.isArray(bf_raw) ? bf_raw[0] : bf_raw) as Record<string, unknown> | null
    const customer = (
      Array.isArray(row.customer) ? (row.customer as unknown[])[0] : row.customer
    ) as Record<string, unknown> | null

    return {
      bookingId: String(row.id ?? ''),
      serviceTitle: row.service_title_snapshot ? String(row.service_title_snapshot) : null,
      scheduledStart: String(row.scheduled_start ?? ''),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      bookingStatus: String(row.status ?? ''),
      paymentStatus: row.payment_status ? String(row.payment_status) : null,
      cleanerPayoutCents:
        bf?.cleaner_payout_cents != null
          ? Number(bf.cleaner_payout_cents)
          : row.cleaner_payout_cents != null
            ? Number(row.cleaner_payout_cents)
            : null,
      servicePriceCents: bf?.service_price_cents != null ? Number(bf.service_price_cents) : null,
      commissionCents:
        bf?.cleaner_commission_cents != null ? Number(bf.cleaner_commission_cents) : null,
      customerName: customer?.full_name ? String(customer.full_name) : null,
    }
  })

  console.log('[CleanerEarnings] Transactions loaded:', rows.map(r => ({
    bookingId: r.bookingId.slice(0, 8),
    servicePriceCents: r.servicePriceCents,
    commissionCents: r.commissionCents,
    cleanerPayoutCents: r.cleanerPayoutCents,
  })))

  return rows
}

// ─── Chart helper ─────────────────────────────────────────────────────────────

export async function getAdminRevenueChart(year: number): Promise<number[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('payments')
    .select('amount_cents, captured_at, created_at')
    .in('status', ['captured', 'released'])
    .gte('created_at', `${year}-01-01T00:00:00Z`)
    .lt('created_at', `${year + 1}-01-01T00:00:00Z`)

  if (error) throw error

  const monthly = Array(12).fill(0) as number[]
  for (const row of (data ?? []) as { amount_cents: number | null; captured_at: string | null; created_at: string | null }[]) {
    const dateStr = row.captured_at ?? row.created_at
    if (dateStr) {
      const month = new Date(dateStr).getMonth()
      monthly[month] = (monthly[month] ?? 0) + (row.amount_cents ?? 0)
    }
  }
  return monthly
}

// ─── Admin financial audit ────────────────────────────────────────────────────

export interface AuditRow {
  bookingId: string
  serviceTitle: string | null
  bookingStatus: string
  paymentStatus: string | null
  serviceFeeCents: number
  bookingFeeCents: number
  commissionCents: number
  cleanerPayoutCents: number
  platformRevenueCents: number
  quoteCents: number
  completedAt: string | null
  createdAt: string | null
  customerName: string | null
  cleanerName: string | null
}

export async function getFinancialAudit(limit = 50, offset = 0): Promise<AuditRow[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('booking_financials')
    .select(
      `booking_id,
       service_price_cents, booking_fee_cents,
       cleaner_commission_cents, cleaner_payout_cents,
       platform_revenue_cents, quote_cents,
       booking:bookings!booking_id(
         status, payment_status, service_title_snapshot,
         completed_at, created_at,
         customer:profiles!customer_id(full_name),
         cleaner:profiles!cleaner_id(full_name)
       )`,
    )
    .order('booking_id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return ((data ?? []) as unknown[]).map((raw): AuditRow => {
    const row = raw as Record<string, unknown>
    const booking = (
      Array.isArray(row.booking) ? row.booking[0] : row.booking
    ) as Record<string, unknown> | null
    const customer = (
      Array.isArray(booking?.customer) ? (booking?.customer as unknown[])[0] : booking?.customer
    ) as Record<string, unknown> | null
    const cleaner = (
      Array.isArray(booking?.cleaner) ? (booking?.cleaner as unknown[])[0] : booking?.cleaner
    ) as Record<string, unknown> | null

    return {
      bookingId: String(row.booking_id ?? ''),
      serviceTitle: booking?.service_title_snapshot ? String(booking.service_title_snapshot) : null,
      bookingStatus: booking ? String(booking.status ?? '') : '',
      paymentStatus: booking?.payment_status ? String(booking.payment_status) : null,
      serviceFeeCents: Number(row.service_price_cents ?? 0),
      bookingFeeCents: Number(row.booking_fee_cents ?? 0),
      commissionCents: Number(row.cleaner_commission_cents ?? 0),
      cleanerPayoutCents: Number(row.cleaner_payout_cents ?? 0),
      platformRevenueCents: Number(row.platform_revenue_cents ?? 0),
      quoteCents: Number(row.quote_cents ?? 0),
      completedAt: booking?.completed_at ? String(booking.completed_at) : null,
      createdAt: booking?.created_at ? String(booking.created_at) : null,
      customerName: customer?.full_name ? String(customer.full_name) : null,
      cleanerName: cleaner?.full_name ? String(cleaner.full_name) : null,
    }
  })
}

// ─── Formatting helpers (re-exported for convenience) ────────────────────────

export { formatPence }
