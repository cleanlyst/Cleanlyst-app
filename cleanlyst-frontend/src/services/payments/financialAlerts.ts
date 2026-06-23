/**
 * financialAlerts — detects alert conditions from financial data.
 *
 * Generates structured alert objects when conditions warrant operational attention.
 * Persistence is the caller's responsibility — this service only detects and returns.
 *
 * Alert types:
 *   CAPTURE_MISSING      — authorization exists but no capture after threshold
 *   PAYOUT_OVERDUE       — booking completed but no payout after threshold
 *   REFUND_FAILED        — PAYMENT_REFUNDED in ledger but payments.status still captured
 *   LEDGER_MISMATCH      — ledger state diverges from projection
 *   DUPLICATE_STRIPE_EVENT — same stripe event processed twice
 *   MULTIPLE_PAYOUTS     — more than one payout released
 *
 * Pure read. No writes.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { getLedgerEvents, deriveStateFromEvents } from './paymentLedgerResolver'
import { log } from './financialLogger'

export type AlertType =
  | 'CAPTURE_MISSING'
  | 'PAYOUT_OVERDUE'
  | 'REFUND_FAILED'
  | 'LEDGER_MISMATCH'
  | 'DUPLICATE_STRIPE_EVENT'
  | 'MULTIPLE_PAYOUTS'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface FinancialAlert {
  id:          string
  bookingId:   string
  alertType:   AlertType
  severity:    AlertSeverity
  title:       string
  description: string
  detectedAt:  string
  metadata:    Record<string, unknown>
}

const ALERT_SEVERITY: Record<AlertType, AlertSeverity> = {
  CAPTURE_MISSING:        'warning',
  PAYOUT_OVERDUE:         'warning',
  REFUND_FAILED:          'critical',
  LEDGER_MISMATCH:        'critical',
  DUPLICATE_STRIPE_EVENT: 'critical',
  MULTIPLE_PAYOUTS:       'critical',
}

const ALERT_TITLE: Record<AlertType, string> = {
  CAPTURE_MISSING:        'Payment Not Captured',
  PAYOUT_OVERDUE:         'Payout Overdue',
  REFUND_FAILED:          'Refund Status Mismatch',
  LEDGER_MISMATCH:        'Ledger/Projection Mismatch',
  DUPLICATE_STRIPE_EVENT: 'Duplicate Stripe Event',
  MULTIPLE_PAYOUTS:       'Multiple Payouts Detected',
}

let alertSeq = 0
function makeAlert(
  bookingId: string,
  alertType: AlertType,
  description: string,
  metadata: Record<string, unknown> = {},
): FinancialAlert {
  return {
    id:          `alert-${Date.now()}-${++alertSeq}`,
    bookingId,
    alertType,
    severity:    ALERT_SEVERITY[alertType],
    title:       ALERT_TITLE[alertType],
    description,
    detectedAt:  new Date().toISOString(),
    metadata,
  }
}

// Thresholds
const CAPTURE_MISSING_THRESHOLD_H  = 24
const PAYOUT_OVERDUE_THRESHOLD_H   = 72

/**
 * Detects all alert conditions for a single booking.
 * Returns an array of alerts — empty means healthy.
 */
export async function detectBookingAlerts(bookingId: string): Promise<FinancialAlert[]> {
  const supabase = getSupabaseClient()
  const alerts: FinancialAlert[] = []
  const now = Date.now()

  const [events, bookingResult, paymentResult] = await Promise.all([
    getLedgerEvents(bookingId),
    supabase
      .from('bookings')
      .select('status, completed_at, payment_status')
      .eq('id', bookingId)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('status')
      .eq('booking_id', bookingId)
      .maybeSingle(),
  ])

  const authorized = events.filter((e) => e.eventType === 'PAYMENT_AUTHORIZED')
  const captured   = events.filter((e) => e.eventType === 'PAYMENT_CAPTURED')
  const refunded   = events.filter((e) => e.eventType === 'PAYMENT_REFUNDED')
  const payouts    = events.filter((e) => e.eventType === 'PAYOUT_RELEASED')

  const booking = bookingResult.data
  const payment = paymentResult.data

  // ── Capture missing ────────────────────────────────────────────────────────
  if (authorized.length > 0 && captured.length === 0 && refunded.length === 0) {
    const authAge = now - new Date(authorized[0].createdAt).getTime()
    if (authAge > CAPTURE_MISSING_THRESHOLD_H * 60 * 60 * 1000) {
      const ageH = Math.round(authAge / (1000 * 60 * 60))
      alerts.push(makeAlert(
        bookingId,
        'CAPTURE_MISSING',
        `Payment authorized ${ageH}h ago but never captured. Stripe hold may expire.`,
        { authorizedAt: authorized[0].createdAt, ageHours: ageH },
      ))
    }
  }

  // ── Payout overdue ─────────────────────────────────────────────────────────
  if (booking?.completed_at && payouts.length === 0 && refunded.length === 0) {
    const completedAge = now - new Date(booking.completed_at).getTime()
    if (completedAge > PAYOUT_OVERDUE_THRESHOLD_H * 60 * 60 * 1000) {
      const ageH = Math.round(completedAge / (1000 * 60 * 60))
      alerts.push(makeAlert(
        bookingId,
        'PAYOUT_OVERDUE',
        `Booking completed ${ageH}h ago but no payout released to cleaner.`,
        { completedAt: booking.completed_at, ageHours: ageH },
      ))
    }
  }

  // ── Refund failed ──────────────────────────────────────────────────────────
  if (refunded.length > 0 && payment?.status === 'captured') {
    alerts.push(makeAlert(
      bookingId,
      'REFUND_FAILED',
      'Ledger shows PAYMENT_REFUNDED but payments.status is still "captured" — projection sync may have failed.',
      { ledgerRefundAt: refunded[0].createdAt, paymentStatus: payment.status },
    ))
  }

  // ── Ledger mismatch ────────────────────────────────────────────────────────
  const ledgerState = deriveStateFromEvents(events)
  if (booking && ledgerState !== booking.payment_status) {
    alerts.push(makeAlert(
      bookingId,
      'LEDGER_MISMATCH',
      `Ledger derives "${ledgerState}" but booking.payment_status is "${booking.payment_status}".`,
      { ledgerState, cachedState: booking.payment_status },
    ))
  }

  // ── Duplicate Stripe events ────────────────────────────────────────────────
  const seenIds = new Map<string, number>()
  for (const e of events) {
    seenIds.set(e.stripeEventId, (seenIds.get(e.stripeEventId) ?? 0) + 1)
  }
  for (const [stripeEventId, count] of seenIds) {
    if (count > 1) {
      alerts.push(makeAlert(
        bookingId,
        'DUPLICATE_STRIPE_EVENT',
        `stripe_event_id "${stripeEventId}" appears ${count} times in ledger — idempotency breach.`,
        { stripeEventId, count },
      ))
    }
  }

  // ── Multiple payouts ───────────────────────────────────────────────────────
  if (payouts.length > 1) {
    alerts.push(makeAlert(
      bookingId,
      'MULTIPLE_PAYOUTS',
      `${payouts.length} PAYOUT_RELEASED events in ledger — cleaner may have been paid multiple times.`,
      { payoutCount: payouts.length },
    ))
  }

  for (const alert of alerts) {
    log.anomalyDetected(bookingId, alert.alertType, {
      severity:    alert.severity,
      description: alert.description,
    })
  }

  return alerts
}

/**
 * Detects alerts across multiple bookings in parallel.
 */
export async function detectAlertsForBookings(bookingIds: string[]): Promise<FinancialAlert[]> {
  const allAlerts = await Promise.all(bookingIds.map(detectBookingAlerts))
  return allAlerts.flat()
}

/**
 * Filters a list of alerts by severity.
 */
export function filterAlertsBySeverity(
  alerts: FinancialAlert[],
  minSeverity: AlertSeverity,
): FinancialAlert[] {
  const order: Record<AlertSeverity, number> = { info: 0, warning: 1, critical: 2 }
  return alerts.filter((a) => order[a.severity] >= order[minSeverity])
}
