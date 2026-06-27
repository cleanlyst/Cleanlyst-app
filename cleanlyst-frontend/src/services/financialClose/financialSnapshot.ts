/**
 * financialSnapshot — calculates period-level financial metrics.
 *
 * Queries booking, payment, payout, and ledger data for a given date range
 * and aggregates into a structured snapshot. Pure read. No writes.
 *
 * All amounts in pence (GBP).
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import type { ClosePeriod, PeriodBookingRow } from './types'

// Stripe fee estimate: 2.9% + 30p per transaction
const STRIPE_RATE    = 0.029
const STRIPE_FIXED_P = 30

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export interface PeriodSnapshot {
  bookingsCreated:    number
  bookingsCompleted:  number
  bookingsCancelled:  number
  authorizedPayments: number
  capturedPayments:   number
  refundedPayments:   number
  partialRefunds:     number
  failedPayments:     number
  grossRevenueCents:         number
  platformRevenueCents:      number
  cleanerPayoutsCents:       number
  totalRefundsCents:         number
  netRevenueCents:           number
  estimatedStripeFeesCents:  number
  pendingAuthorizationCount: number
  outstandingPayoutsCents:   number
  completedPayoutsCents:     number
  bookingIds: string[]
}

/**
 * Returns all booking IDs created in the period.
 * Used by reconciliation to scope per-booking scans.
 */
export async function getBookingIdsForPeriod(period: ClosePeriod): Promise<string[]> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .gte('created_at', period.start.toISOString())
    .lt('created_at', period.end.toISOString())
  return (data ?? []).map((r: { id: string }) => r.id)
}

/**
 * Builds the full period snapshot.
 *
 * Fetches bookings for the period first, then fetches all related data
 * by booking ID to avoid inconsistency between table-level created_at dates.
 */
export async function buildPeriodSnapshot(period: ClosePeriod): Promise<PeriodSnapshot> {
  const supabase    = getSupabaseClient()
  const periodStart = period.start.toISOString()
  const periodEnd   = period.end.toISOString()

  // Step 1: fetch bookings created in the period
  const { data: bookingData } = await supabase
    .from('bookings')
    .select('id, status, payment_status, created_at, completed_at, cancelled_at, quote_cents, cleaner_payout_cents')
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  const bookings   = (bookingData ?? []) as PeriodBookingRow[]
  const bookingIds = bookings.map((b) => b.id)

  if (!bookingIds.length) {
    return {
      bookingsCreated: 0, bookingsCompleted: 0, bookingsCancelled: 0,
      authorizedPayments: 0, capturedPayments: 0, refundedPayments: 0,
      partialRefunds: 0, failedPayments: 0,
      grossRevenueCents: 0, platformRevenueCents: 0, cleanerPayoutsCents: 0,
      totalRefundsCents: 0, netRevenueCents: 0, estimatedStripeFeesCents: 0,
      pendingAuthorizationCount: 0, outstandingPayoutsCents: 0, completedPayoutsCents: 0,
      bookingIds: [],
    }
  }

  // Step 2: fetch related tables by booking ID in parallel
  // chunk to stay within Supabase .in() limit
  const idChunks = chunk(bookingIds, 400)

  const [payments, payouts, ledger, financials] = await Promise.all([
    Promise.all(idChunks.map((ids) =>
      supabase.from('payments').select('booking_id, status, amount_cents').in('booking_id', ids),
    )).then((rs) => rs.flatMap((r) => r.data ?? []) as { booking_id: string; status: string; amount_cents: number | null }[]),

    Promise.all(idChunks.map((ids) =>
      supabase.from('payouts').select('booking_id, status, amount_cents, released_at').in('booking_id', ids),
    )).then((rs) => rs.flatMap((r) => r.data ?? []) as { booking_id: string; status: string; amount_cents: number | null; released_at: string | null }[]),

    Promise.all(idChunks.map((ids) =>
      supabase.from('payment_ledger_events').select('booking_id, event_type, amount_cents').in('booking_id', ids),
    )).then((rs) => rs.flatMap((r) => r.data ?? []) as { booking_id: string; event_type: string; amount_cents: number | null }[]),

    // platform_fee_cents + booking_fee_cents = platform revenue
    Promise.all(idChunks.map((ids) =>
      supabase.from('booking_financials').select('booking_id, cleaner_payout_cents, platform_fee_cents, booking_fee_cents').in('booking_id', ids),
    )).then((rs) => rs.flatMap((r) => r.data ?? []) as { booking_id: string; cleaner_payout_cents: number | null; platform_fee_cents: number | null; booking_fee_cents: number | null }[]),
  ])

  // ── Booking metrics ────────────────────────────────────────────────────────
  const bookingsCreated   = bookings.length
  const bookingsCompleted = bookings.filter((b) => b.status === 'completed' || b.status === 'payout_released').length
  const bookingsCancelled = bookings.filter((b) => ['cancelled', 'cleaner_cancelled', 'refunded'].includes(b.status)).length

  // ── Payment metrics ────────────────────────────────────────────────────────
  const capturedPayments  = payments.filter((p) => p.status === 'captured').length
  const refundedPayments  = payments.filter((p) => p.status === 'refunded').length
  const failedPayments    = payments.filter((p) => p.status === 'failed').length

  const ledgerAuthorized  = ledger.filter((e) => e.event_type === 'PAYMENT_AUTHORIZED')
  const ledgerCaptured    = ledger.filter((e) => e.event_type === 'PAYMENT_CAPTURED')
  const ledgerRefunded    = ledger.filter((e) => e.event_type === 'PAYMENT_REFUNDED')
  const authorizedPayments = ledgerAuthorized.length
  const pendingAuthorizationCount = Math.max(0, ledgerAuthorized.length - ledgerCaptured.length - ledgerRefunded.length)

  // Partial refunds: where refund amount < original captured amount
  // Proxy: if multiple PAYMENT_REFUNDED events per booking or amount < captured
  const refundByBooking = new Map<string, number>()
  for (const e of ledgerRefunded) {
    refundByBooking.set(e.booking_id, (refundByBooking.get(e.booking_id) ?? 0) + (e.amount_cents ?? 0))
  }
  const captureByBooking = new Map<string, number>()
  for (const e of ledgerCaptured) {
    captureByBooking.set(e.booking_id, (captureByBooking.get(e.booking_id) ?? 0) + (e.amount_cents ?? 0))
  }
  const partialRefunds = [...refundByBooking.entries()].filter(([bid, refundAmt]) => {
    const capturedAmt = captureByBooking.get(bid) ?? Infinity
    return refundAmt < capturedAmt
  }).length

  // ── Revenue ───────────────────────────────────────────────────────────────
  const grossRevenueCents = ledgerCaptured.reduce((s, e) => s + (e.amount_cents ?? 0), 0)
  const totalRefundsCents = ledgerRefunded.reduce((s, e) => s + (e.amount_cents ?? 0), 0)

  // Use booking_financials for platform/cleaner split
  // platform revenue = platform_fee_cents + booking_fee_cents (both kept by Cleanlyst)
  const platformRevenueCents = financials.reduce(
    (s, f) => s + (f.platform_fee_cents ?? 0) + (f.booking_fee_cents ?? 0),
    0,
  )
  const cleanerPayoutsCents = financials.reduce((s, f) => s + (f.cleaner_payout_cents ?? 0), 0)
  const netRevenueCents     = Math.max(0, platformRevenueCents - totalRefundsCents)

  // Estimated Stripe fees on captured payments in this period
  const estimatedStripeFeesCents = capturedPayments > 0
    ? Math.round(grossRevenueCents * STRIPE_RATE) + (capturedPayments * STRIPE_FIXED_P)
    : 0

  // ── Payouts ───────────────────────────────────────────────────────────────
  const releasedPayouts = payouts.filter((p) => ['released', 'paid'].includes(p.status))
  const pendingPayouts  = payouts.filter((p) => p.status === 'pending')
  const completedPayoutsCents   = releasedPayouts.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
  const outstandingPayoutsCents = pendingPayouts.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  return {
    bookingsCreated,
    bookingsCompleted,
    bookingsCancelled,
    authorizedPayments,
    capturedPayments,
    refundedPayments,
    partialRefunds,
    failedPayments,
    grossRevenueCents,
    platformRevenueCents,
    cleanerPayoutsCents,
    totalRefundsCents,
    netRevenueCents,
    estimatedStripeFeesCents,
    pendingAuthorizationCount,
    outstandingPayoutsCents,
    completedPayoutsCents,
    bookingIds,
  }
}
