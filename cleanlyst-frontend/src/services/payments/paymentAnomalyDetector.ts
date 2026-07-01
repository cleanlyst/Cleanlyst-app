/**
 * paymentAnomalyDetector — pattern-based anomaly detection over ledger + booking data.
 *
 * Detects:
 *   AUTHORIZATION_EXPIRED      — authorized > 7 days ago with no capture or refund
 *   CAPTURED_NEVER_COMPLETED   — captured payment but booking not in terminal state
 *   COMPLETED_PAYOUT_MISSING   — booking completed but no PAYOUT_RELEASED in ledger
 *   REFUND_AFTER_PAYOUT        — PAYMENT_REFUNDED timestamp after PAYOUT_RELEASED
 *   MULTIPLE_CAPTURES          — more than one PAYMENT_CAPTURED event
 *   MULTIPLE_PAYOUTS           — more than one PAYOUT_RELEASED event
 *   DUPLICATE_STRIPE_EVENT     — same stripe_event_id appears in multiple ledger rows
 *   UNEXPECTED_LEDGER_ORDER    — capture before authorization, refund before authorization
 *
 * Pure read. No writes.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { getLedgerEvents, type LedgerEvent } from './paymentLedgerResolver'
import { log } from './financialLogger'

export type AnomalyType =
  | 'AUTHORIZATION_EXPIRED'
  | 'CAPTURED_NEVER_COMPLETED'
  | 'COMPLETED_PAYOUT_MISSING'
  | 'REFUND_AFTER_PAYOUT'
  | 'MULTIPLE_CAPTURES'
  | 'MULTIPLE_PAYOUTS'
  | 'DUPLICATE_STRIPE_EVENT'
  | 'UNEXPECTED_LEDGER_ORDER'

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AnomalyReport {
  bookingId:   string
  anomalyType: AnomalyType
  severity:    AnomalySeverity
  description: string
  detectedAt:  string
  metadata:    Record<string, unknown>
}

const SEVERITY: Record<AnomalyType, AnomalySeverity> = {
  AUTHORIZATION_EXPIRED:    'medium',
  CAPTURED_NEVER_COMPLETED: 'low',
  COMPLETED_PAYOUT_MISSING: 'high',
  REFUND_AFTER_PAYOUT:      'critical',
  MULTIPLE_CAPTURES:        'critical',
  MULTIPLE_PAYOUTS:         'critical',
  DUPLICATE_STRIPE_EVENT:   'critical',
  UNEXPECTED_LEDGER_ORDER:  'high',
}

function makeAnomaly(
  bookingId: string,
  anomalyType: AnomalyType,
  description: string,
  metadata: Record<string, unknown> = {},
): AnomalyReport {
  return {
    bookingId,
    anomalyType,
    severity:    SEVERITY[anomalyType],
    description,
    detectedAt:  new Date().toISOString(),
    metadata,
  }
}

interface BookingContext {
  status:       string | null
  completedAt:  string | null
  cancelledAt:  string | null
}

async function fetchBookingContext(bookingId: string): Promise<BookingContext> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select('status, completed_at, cancelled_at')
    .eq('id', bookingId)
    .maybeSingle()
  return {
    status:      data?.status ?? null,
    completedAt: data?.completed_at ?? null,
    cancelledAt: data?.cancelled_at ?? null,
  }
}

// ─── Authorization expiry window — Stripe captures expire after 7 days ────────
const AUTH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

const TERMINAL_STATUSES = new Set([
  'completed', 'completion_pending_customer', 'cancelled', 'refunded',
  'disputed', 'cleaner_cancelled', 'cleaner_no_show',
])

/**
 * Detects anomalies for a single booking. No DB writes.
 */
export async function detectBookingAnomalies(bookingId: string): Promise<AnomalyReport[]> {
  const [events, booking] = await Promise.all([
    getLedgerEvents(bookingId),
    fetchBookingContext(bookingId),
  ])

  const anomalies: AnomalyReport[] = []
  const now = Date.now()

  const authorized = events.filter((e) => e.eventType === 'PAYMENT_AUTHORIZED')
  const captured   = events.filter((e) => e.eventType === 'PAYMENT_CAPTURED')
  const refunded   = events.filter((e) => e.eventType === 'PAYMENT_REFUNDED')
  const payouts    = events.filter((e) => e.eventType === 'PAYOUT_RELEASED')

  const authTime   = authorized[0] ? new Date(authorized[0].createdAt).getTime() : null
  const captureTime = captured[0]  ? new Date(captured[0].createdAt).getTime()  : null
  const refundTime  = refunded[0]  ? new Date(refunded[0].createdAt).getTime()  : null
  const payoutTime  = payouts[0]   ? new Date(payouts[0].createdAt).getTime()   : null

  // ── Authorization expired ──────────────────────────────────────────────────
  if (
    authorized.length > 0 &&
    captured.length === 0 &&
    refunded.length === 0 &&
    authTime !== null &&
    now - authTime > AUTH_EXPIRY_MS
  ) {
    const ageHours = Math.round((now - authTime) / (1000 * 60 * 60))
    anomalies.push(makeAnomaly(
      bookingId,
      'AUTHORIZATION_EXPIRED',
      `Authorization is ${ageHours}h old with no capture or refund — Stripe hold may have expired`,
      { authorizedAt: authorized[0]!.createdAt, ageHours },
    ))
  }

  // ── Captured but never completed ───────────────────────────────────────────
  if (captured.length > 0 && booking.status && !TERMINAL_STATUSES.has(booking.status)) {
    const capturedAt = captured[0]!.createdAt
    const capturedAgeH = Math.round((now - (captureTime ?? 0)) / (1000 * 60 * 60))
    if (capturedAgeH > 48) {
      anomalies.push(makeAnomaly(
        bookingId,
        'CAPTURED_NEVER_COMPLETED',
        `Payment captured ${capturedAgeH}h ago but booking status is "${booking.status}"`,
        { capturedAt, bookingStatus: booking.status, capturedAgeHours: capturedAgeH },
      ))
    }
  }

  // ── Completed but payout missing ───────────────────────────────────────────
  if (booking.completedAt && payouts.length === 0 && refunded.length === 0) {
    const completedAgeH = Math.round(
      (now - new Date(booking.completedAt).getTime()) / (1000 * 60 * 60),
    )
    if (completedAgeH > 72) {
      anomalies.push(makeAnomaly(
        bookingId,
        'COMPLETED_PAYOUT_MISSING',
        `Booking completed ${completedAgeH}h ago but no PAYOUT_RELEASED in ledger`,
        { completedAt: booking.completedAt, completedAgeHours: completedAgeH },
      ))
    }
  }

  // ── Refund after payout ────────────────────────────────────────────────────
  if (refundTime !== null && payoutTime !== null && refundTime > payoutTime) {
    anomalies.push(makeAnomaly(
      bookingId,
      'REFUND_AFTER_PAYOUT',
      'PAYMENT_REFUNDED timestamp is after PAYOUT_RELEASED — cleaner may have already been paid',
      {
        payoutReleasedAt: payouts[0]!.createdAt,
        refundIssuedAt:   refunded[0]!.createdAt,
      },
    ))
  }

  // ── Multiple captures ──────────────────────────────────────────────────────
  if (captured.length > 1) {
    anomalies.push(makeAnomaly(
      bookingId,
      'MULTIPLE_CAPTURES',
      `${captured.length} PAYMENT_CAPTURED events detected — customer may have been charged multiple times`,
      { captureCount: captured.length, captureEventIds: captured.map((e) => e.stripeEventId) },
    ))
  }

  // ── Multiple payouts ───────────────────────────────────────────────────────
  if (payouts.length > 1) {
    anomalies.push(makeAnomaly(
      bookingId,
      'MULTIPLE_PAYOUTS',
      `${payouts.length} PAYOUT_RELEASED events detected — cleaner may have been paid multiple times`,
      { payoutCount: payouts.length, payoutTransferIds: payouts.map((e) => e.stripeTransferId) },
    ))
  }

  // ── Duplicate Stripe event IDs ─────────────────────────────────────────────
  const eventIdCounts = new Map<string, number>()
  for (const e of events) {
    eventIdCounts.set(e.stripeEventId, (eventIdCounts.get(e.stripeEventId) ?? 0) + 1)
  }
  for (const [stripeEventId, count] of eventIdCounts) {
    if (count > 1) {
      anomalies.push(makeAnomaly(
        bookingId,
        'DUPLICATE_STRIPE_EVENT',
        `stripe_event_id "${stripeEventId}" appears ${count} times in ledger — idempotency violation`,
        { stripeEventId, count },
      ))
    }
  }

  // ── Unexpected ledger ordering ─────────────────────────────────────────────
  if (authTime && captureTime && captureTime < authTime) {
    anomalies.push(makeAnomaly(
      bookingId,
      'UNEXPECTED_LEDGER_ORDER',
      'PAYMENT_CAPTURED precedes PAYMENT_AUTHORIZED — chronological impossibility',
      { authorizedAt: authorized[0]!.createdAt, capturedAt: captured[0]!.createdAt },
    ))
  }
  if (authTime && refundTime && refundTime < authTime) {
    anomalies.push(makeAnomaly(
      bookingId,
      'UNEXPECTED_LEDGER_ORDER',
      'PAYMENT_REFUNDED precedes PAYMENT_AUTHORIZED — chronological impossibility',
      { authorizedAt: authorized[0]!.createdAt, refundedAt: refunded[0]!.createdAt },
    ))
  }

  for (const anomaly of anomalies) {
    log.anomalyDetected(bookingId, anomaly.anomalyType, {
      severity:    anomaly.severity,
      description: anomaly.description,
    })
  }

  return anomalies
}

/**
 * Detects anomalies across multiple bookings in parallel.
 * Returns all anomaly reports (not just the first violation per booking).
 */
export async function detectMultipleBookingAnomalies(
  bookingIds: string[],
): Promise<AnomalyReport[]> {
  const allReports = await Promise.all(bookingIds.map(detectBookingAnomalies))
  return allReports.flat()
}

/**
 * Detects anomalies scoped to a specific anomaly type across multiple bookings.
 */
export async function detectAnomalyType(
  bookingIds: string[],
  type: AnomalyType,
): Promise<AnomalyReport[]> {
  const all = await detectMultipleBookingAnomalies(bookingIds)
  return all.filter((r) => r.anomalyType === type)
}
