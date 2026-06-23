/**
 * ledgerReconciliationService — detects mismatches across all financial layers.
 *
 * Comparisons:
 *   reconcileBooking()        — ledger vs bookings.payment_status (per booking)
 *   compareStripeToLedger()   — payment_webhook_events vs payment_ledger_events
 *   compareLedgerToBookings() — ledger state vs bookings projections
 *   compareLedgerToPayments() — ledger state vs payments table projections
 *   compareLedgerToPayouts()  — ledger state vs payouts table projections
 *
 * LOG ONLY — no auto-fix. All functions return reports for caller inspection.
 * Pure read. No writes.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { getLedgerEvents, deriveStateFromEvents, type DerivedPaymentState } from './paymentLedgerResolver'
import { log } from './financialLogger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconciliationReport {
  bookingId:           string
  ledgerState:         DerivedPaymentState
  cachedPaymentStatus: string | null
  hasMismatch:         boolean
  mismatches:          string[]
  checkedAt:           string
  ledgerEventCount:    number
}

export interface StripeToLedgerReport {
  checkedAt:             string
  totalWebhookEvents:    number
  processedWebhookEvents: number
  ledgerEventCount:      number
  missingFromLedger:     string[]  // stripe_event_ids in webhook table but not in ledger
  orphanLedgerEvents:    string[]  // stripe_event_ids in ledger but not in webhook table
  duplicatedCaptures:    string[]  // booking_ids with >1 PAYMENT_CAPTURED
  hasMismatch:           boolean
}

export interface LedgerToBookingsReport {
  checkedAt:           string
  bookingsChecked:     number
  mismatches:          Array<{
    bookingId:          string
    issue:              string
    ledgerState:        DerivedPaymentState
    cachedStatus:       string | null
    bookingStatus:      string | null
  }>
  hasMismatch: boolean
}

export interface LedgerToPaymentsReport {
  checkedAt:       string
  paymentsChecked: number
  mismatches:      Array<{
    bookingId:    string
    issue:        string
    ledgerState:  DerivedPaymentState
    paymentStatus: string | null
  }>
  hasMismatch: boolean
}

export interface LedgerToPayoutsReport {
  checkedAt:      string
  payoutsChecked: number
  mismatches:     Array<{
    bookingId:   string
    issue:       string
    payoutStatus: string | null
    ledgerHasPayout: boolean
  }>
  orphanPayouts:  string[]  // payouts with no PAYOUT_RELEASED ledger event
  hasMismatch:    boolean
}

// ─── Stripe event types that should generate a ledger entry ───────────────────
const LEDGER_GENERATING_STRIPE_TYPES = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'charge.refunded',
  'payment_intent.canceled',
  'transfer.paid',
])

// ─── per-booking reconciliation ───────────────────────────────────────────────

/**
 * Reconciles ledger-derived state with the booking's cached payment_status.
 * Does NOT mutate any records.
 */
export async function reconcileBooking(bookingId: string): Promise<ReconciliationReport> {
  const supabase = getSupabaseClient()
  const mismatches: string[] = []

  const [ledgerEvents, bookingResult] = await Promise.all([
    getLedgerEvents(bookingId),
    supabase
      .from('bookings')
      .select('id, payment_status, status, updated_at')
      .eq('id', bookingId)
      .maybeSingle(),
  ])

  const ledgerState         = deriveStateFromEvents(ledgerEvents)
  const cachedPaymentStatus = bookingResult.data?.payment_status ?? null

  if (ledgerState !== cachedPaymentStatus) {
    mismatches.push(
      `payment_status mismatch: ledger="${ledgerState}" cache="${cachedPaymentStatus}"`,
    )
  }

  if (
    ledgerEvents.some((e) => e.eventType === 'PAYMENT_CAPTURED') &&
    bookingResult.data?.status === 'payment_authorized'
  ) {
    mismatches.push(
      `booking.status still "payment_authorized" but ledger has PAYMENT_CAPTURED — trigger may have failed`,
    )
  }

  if (
    ledgerEvents.some((e) => e.eventType === 'PAYMENT_REFUNDED') &&
    cachedPaymentStatus !== 'refunded'
  ) {
    mismatches.push(
      `ledger has PAYMENT_REFUNDED but cache shows "${cachedPaymentStatus}"`,
    )
  }

  const report: ReconciliationReport = {
    bookingId,
    ledgerState,
    cachedPaymentStatus,
    hasMismatch:      mismatches.length > 0,
    mismatches,
    checkedAt:        new Date().toISOString(),
    ledgerEventCount: ledgerEvents.length,
  }

  if (report.hasMismatch) {
    log.ledgerMismatch(bookingId, mismatches.join('; '))
  }

  return report
}

/**
 * Reconciles multiple bookings in parallel. Returns only reports with mismatches.
 */
export async function reconcileMultipleBookings(
  bookingIds: string[],
): Promise<ReconciliationReport[]> {
  const reports = await Promise.all(bookingIds.map(reconcileBooking))
  return reports.filter((r) => r.hasMismatch)
}

// ─── compareStripeToLedger ────────────────────────────────────────────────────

/**
 * Compares payment_webhook_events (all Stripe events received) against
 * payment_ledger_events (what was written to the ledger).
 *
 * Detects:
 *   - Stripe events that should have generated a ledger entry but did not
 *   - Ledger entries with no matching processed webhook (bypass detection)
 *   - Duplicate PAYMENT_CAPTURED events per booking
 */
export async function compareStripeToLedger(options: {
  limit?: number
} = {}): Promise<StripeToLedgerReport> {
  const supabase = getSupabaseClient()
  const limit = options.limit ?? 1000

  const [webhookResult, ledgerResult] = await Promise.all([
    supabase
      .from('payment_webhook_events')
      .select('stripe_event_id, stripe_event_type, processed_at')
      .order('received_at', { ascending: false })
      .limit(limit),

    supabase
      .from('payment_ledger_events')
      .select('stripe_event_id, event_type, booking_id')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const webhookRows = (webhookResult.data ?? []) as {
    stripe_event_id: string
    stripe_event_type: string
    processed_at: string | null
  }[]

  const ledgerRows = (ledgerResult.data ?? []) as {
    stripe_event_id: string
    event_type: string
    booking_id: string
  }[]

  const processedWebhooks = webhookRows.filter((r) => r.processed_at !== null)
  const ledgerEventIdSet  = new Set(ledgerRows.map((r) => r.stripe_event_id))
  const webhookEventIdSet = new Set(webhookRows.map((r) => r.stripe_event_id))

  // Events that should have generated a ledger entry but didn't
  const missingFromLedger = processedWebhooks
    .filter(
      (w) =>
        LEDGER_GENERATING_STRIPE_TYPES.has(w.stripe_event_type) &&
        !ledgerEventIdSet.has(w.stripe_event_id),
    )
    .map((w) => w.stripe_event_id)

  // Ledger entries with no matching webhook event (wrote to ledger without going through webhook)
  const orphanLedgerEvents = ledgerRows
    .filter((l) => !webhookEventIdSet.has(l.stripe_event_id))
    .map((l) => l.stripe_event_id)

  // Duplicate PAYMENT_CAPTURED per booking
  const capturedByBooking = new Map<string, number>()
  for (const row of ledgerRows.filter((r) => r.event_type === 'PAYMENT_CAPTURED')) {
    capturedByBooking.set(row.booking_id, (capturedByBooking.get(row.booking_id) ?? 0) + 1)
  }
  const duplicatedCaptures = [...capturedByBooking.entries()]
    .filter(([, count]) => count > 1)
    .map(([bookingId]) => bookingId)

  const hasMismatch =
    missingFromLedger.length > 0 || orphanLedgerEvents.length > 0 || duplicatedCaptures.length > 0

  if (hasMismatch) {
    log.reconciliationFailure('compareStripeToLedger detected mismatches', {
      missingFromLedger: missingFromLedger.length,
      orphanLedgerEvents: orphanLedgerEvents.length,
      duplicatedCaptures: duplicatedCaptures.length,
    })
  }

  return {
    checkedAt:              new Date().toISOString(),
    totalWebhookEvents:     webhookRows.length,
    processedWebhookEvents: processedWebhooks.length,
    ledgerEventCount:       ledgerRows.length,
    missingFromLedger,
    orphanLedgerEvents,
    duplicatedCaptures,
    hasMismatch,
  }
}

// ─── compareLedgerToBookings ──────────────────────────────────────────────────

/**
 * Compares ledger-derived payment state against bookings.payment_status cache.
 * Detects trigger failures or stale cache rows.
 */
export async function compareLedgerToBookings(bookingIds?: string[]): Promise<LedgerToBookingsReport> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('bookings')
    .select('id, payment_status, status')

  if (bookingIds?.length) {
    query = query.in('id', bookingIds)
  } else {
    query = query.not('payment_status', 'eq', 'unpaid')
  }

  const { data: bookingRows } = await query
  const rows = (bookingRows ?? []) as { id: string; payment_status: string | null; status: string | null }[]

  const mismatches: LedgerToBookingsReport['mismatches'] = []

  await Promise.all(rows.map(async (row) => {
    const events     = await getLedgerEvents(row.id)
    const ledgerState = deriveStateFromEvents(events)

    if (ledgerState !== row.payment_status) {
      mismatches.push({
        bookingId:     row.id,
        issue:         `ledger="${ledgerState}" vs booking.payment_status="${row.payment_status}"`,
        ledgerState,
        cachedStatus:  row.payment_status,
        bookingStatus: row.status,
      })
    }

    if (
      events.some((e) => e.eventType === 'PAYMENT_CAPTURED') &&
      row.status === 'payment_authorized'
    ) {
      mismatches.push({
        bookingId:     row.id,
        issue:         'ledger PAYMENT_CAPTURED but booking.status still payment_authorized',
        ledgerState,
        cachedStatus:  row.payment_status,
        bookingStatus: row.status,
      })
    }
  }))

  const hasMismatch = mismatches.length > 0

  if (hasMismatch) {
    log.reconciliationFailure('compareLedgerToBookings detected mismatches', {
      count: mismatches.length,
    })
  }

  return {
    checkedAt:       new Date().toISOString(),
    bookingsChecked: rows.length,
    mismatches,
    hasMismatch,
  }
}

// ─── compareLedgerToPayments ──────────────────────────────────────────────────

/**
 * Verifies that payments table reflects the ledger's source of truth.
 * Detects payments rows whose status does not match ledger-derived state.
 */
export async function compareLedgerToPayments(bookingIds?: string[]): Promise<LedgerToPaymentsReport> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('payments')
    .select('booking_id, status')

  if (bookingIds?.length) {
    query = query.in('booking_id', bookingIds)
  }

  const { data } = await query
  const rows = (data ?? []) as { booking_id: string; status: string | null }[]

  const mismatches: LedgerToPaymentsReport['mismatches'] = []

  await Promise.all(rows.map(async (row) => {
    const events      = await getLedgerEvents(row.booking_id)
    const ledgerState = deriveStateFromEvents(events)

    // Map ledger states to expected payment statuses
    const expectedPaymentStatus: Record<DerivedPaymentState, string> = {
      unpaid:     'unpaid',
      authorized: 'authorized',
      captured:   'captured',
      refunded:   'refunded',
    }

    const expected = expectedPaymentStatus[ledgerState]
    if (expected !== row.status) {
      mismatches.push({
        bookingId:     row.booking_id,
        issue:         `payments.status="${row.status}" but ledger derives "${expected}"`,
        ledgerState,
        paymentStatus: row.status,
      })
    }
  }))

  const hasMismatch = mismatches.length > 0

  if (hasMismatch) {
    log.reconciliationFailure('compareLedgerToPayments detected mismatches', {
      count: mismatches.length,
    })
  }

  return {
    checkedAt:       new Date().toISOString(),
    paymentsChecked: rows.length,
    mismatches,
    hasMismatch,
  }
}

// ─── compareLedgerToPayouts ───────────────────────────────────────────────────

/**
 * Verifies payouts table reflects PAYOUT_RELEASED ledger events.
 * Detects:
 *   - Payouts whose status doesn't match ledger
 *   - Orphan payouts (payout row exists but no ledger PAYOUT_RELEASED event)
 */
export async function compareLedgerToPayouts(bookingIds?: string[]): Promise<LedgerToPayoutsReport> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('payouts')
    .select('booking_id, status, stripe_transfer_id')

  if (bookingIds?.length) {
    query = query.in('booking_id', bookingIds)
  }

  const { data } = await query
  const rows = (data ?? []) as {
    booking_id: string
    status: string | null
    stripe_transfer_id: string | null
  }[]

  const mismatches: LedgerToPayoutsReport['mismatches'] = []
  const orphanPayouts: string[] = []

  await Promise.all(rows.map(async (row) => {
    const events       = await getLedgerEvents(row.booking_id)
    const hasLedgerPayout = events.some((e) => e.eventType === 'PAYOUT_RELEASED')

    if (!hasLedgerPayout && row.status === 'paid') {
      orphanPayouts.push(row.booking_id)
    }

    if (hasLedgerPayout && row.status !== 'paid') {
      mismatches.push({
        bookingId:       row.booking_id,
        issue:           `ledger has PAYOUT_RELEASED but payouts.status="${row.status}"`,
        payoutStatus:    row.status,
        ledgerHasPayout: hasLedgerPayout,
      })
    }

    if (!hasLedgerPayout && row.status === 'pending') {
      // No anomaly — payout is in-flight; ledger entry arrives when transfer.paid fires
    }
  }))

  const hasMismatch = mismatches.length > 0 || orphanPayouts.length > 0

  if (hasMismatch) {
    log.reconciliationFailure('compareLedgerToPayouts detected mismatches', {
      mismatches: mismatches.length,
      orphanPayouts: orphanPayouts.length,
    })
  }

  return {
    checkedAt:      new Date().toISOString(),
    payoutsChecked: rows.length,
    mismatches,
    orphanPayouts,
    hasMismatch,
  }
}
