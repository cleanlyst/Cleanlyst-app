/**
 * financialIntegrityScanner — verifies invariants for a booking's ledger history.
 *
 * Checks:
 *   ✓ Exactly one authorization
 *   ✓ At most one capture
 *   ✓ Refund amount never exceeds capture amount
 *   ✓ Payout amount never exceeds payment amount
 *   ✓ Capture exists before payout
 *   ✓ Authorization precedes any refund
 *   ✓ Payout occurs after booking completion
 *   ✓ No duplicate stripe_event_ids in ledger
 *   ✓ Event ordering is chronologically consistent
 *
 * Pure read. No writes. No side effects.
 */

import { getLedgerEvents, type LedgerEvent, type LedgerEventType } from './paymentLedgerResolver'
import { getSupabaseClient } from '@/services/supabaseClient'
import { log } from './financialLogger'

export interface FinancialIntegrityReport {
  bookingId:   string
  passed:      boolean
  violations:  string[]
  warnings:    string[]
  checkedAt:   string
  eventCount:  number
}

interface BookingSnapshot {
  status:       string | null
  completedAt:  string | null
  amountCents:  number | null
}

async function fetchBookingSnapshot(bookingId: string): Promise<BookingSnapshot> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select('status, completed_at, payments(amount_cents)')
    .eq('id', bookingId)
    .maybeSingle()

  const paymentRow = (data as { payments?: { amount_cents?: number } | null } | null)?.payments
  return {
    status:      data?.status ?? null,
    completedAt: data?.completed_at ?? null,
    amountCents: paymentRow?.amount_cents ?? null,
  }
}

function byType(events: LedgerEvent[], type: LedgerEventType): LedgerEvent[] {
  return events.filter((e) => e.eventType === type)
}

function totalCents(events: LedgerEvent[]): number {
  return events.reduce((sum, e) => sum + (e.amountCents ?? 0), 0)
}

function earliest(events: LedgerEvent[]): string | null {
  if (!events.length) return null
  return events.map((e) => e.createdAt).sort()[0]
}

/**
 * Scans a single booking's ledger events for financial integrity violations.
 * Returns a report — no mutations performed.
 */
export async function scanBookingIntegrity(bookingId: string): Promise<FinancialIntegrityReport> {
  const [events, booking] = await Promise.all([
    getLedgerEvents(bookingId),
    fetchBookingSnapshot(bookingId),
  ])

  const violations: string[] = []
  const warnings:   string[] = []

  const authorized  = byType(events, 'PAYMENT_AUTHORIZED')
  const captured    = byType(events, 'PAYMENT_CAPTURED')
  const refunded    = byType(events, 'PAYMENT_REFUNDED')
  const payouts     = byType(events, 'PAYOUT_RELEASED')

  // ── Authorization ──────────────────────────────────────────────────────────
  if (authorized.length === 0 && events.length > 0) {
    violations.push('No PAYMENT_AUTHORIZED event found — ledger has orphan events without authorization')
  }
  if (authorized.length > 1) {
    violations.push(`Multiple PAYMENT_AUTHORIZED events (${authorized.length}) — expected exactly one`)
  }

  // ── Capture ────────────────────────────────────────────────────────────────
  if (captured.length > 1) {
    violations.push(`Multiple PAYMENT_CAPTURED events (${captured.length}) — expected at most one`)
  }

  // ── Ordering: capture must follow authorization ────────────────────────────
  const authTime    = earliest(authorized)
  const captureTime = earliest(captured)
  const refundTime  = earliest(refunded)
  const payoutTime  = earliest(payouts)

  if (authTime && captureTime && captureTime < authTime) {
    violations.push('PAYMENT_CAPTURED timestamp precedes PAYMENT_AUTHORIZED — impossible ordering')
  }

  // ── Ordering: refund must follow authorization ─────────────────────────────
  if (authTime && refundTime && refundTime < authTime) {
    violations.push('PAYMENT_REFUNDED timestamp precedes PAYMENT_AUTHORIZED — refund before authorization')
  }

  // ── Ordering: payout must follow capture ──────────────────────────────────
  if (captureTime && payoutTime && payoutTime < captureTime) {
    violations.push('PAYOUT_RELEASED timestamp precedes PAYMENT_CAPTURED — payout before capture')
  }

  if (!captureTime && payoutTime) {
    violations.push('PAYOUT_RELEASED exists without any PAYMENT_CAPTURED — payout without capture')
  }

  // ── Ordering: payout requires booking completion ──────────────────────────
  if (payoutTime && booking.completedAt && payoutTime < booking.completedAt) {
    warnings.push('PAYOUT_RELEASED occurred before booking.completed_at — potential premature payout')
  }
  if (payoutTime && !booking.completedAt) {
    warnings.push('PAYOUT_RELEASED but booking has no completed_at — incomplete booking may have been paid out')
  }

  // ── Amount integrity: refund ≤ capture ────────────────────────────────────
  const capturedCents = totalCents(captured)
  const refundedCents = totalCents(refunded)

  if (refundedCents > 0 && capturedCents > 0 && refundedCents > capturedCents) {
    violations.push(
      `Refund total (${refundedCents}p) exceeds capture total (${capturedCents}p) — over-refund detected`,
    )
  }

  // ── Amount integrity: payout ≤ payment amount ─────────────────────────────
  const payoutCents = totalCents(payouts)
  if (booking.amountCents && payoutCents > booking.amountCents) {
    violations.push(
      `Payout total (${payoutCents}p) exceeds payment amount (${booking.amountCents}p)`,
    )
  }

  // ── Duplicate stripe_event_ids ────────────────────────────────────────────
  const seenEventIds = new Set<string>()
  for (const e of events) {
    if (seenEventIds.has(e.stripeEventId)) {
      violations.push(`Duplicate stripe_event_id in ledger: ${e.stripeEventId}`)
    }
    seenEventIds.add(e.stripeEventId)
  }

  // ── Multiple payouts ──────────────────────────────────────────────────────
  if (payouts.length > 1) {
    violations.push(`Multiple PAYOUT_RELEASED events (${payouts.length}) — expected at most one`)
  }

  const passed = violations.length === 0

  const report: FinancialIntegrityReport = {
    bookingId,
    passed,
    violations,
    warnings,
    checkedAt:  new Date().toISOString(),
    eventCount: events.length,
  }

  if (!passed) {
    log.integrityViolation(bookingId, violations)
  }

  return report
}

/**
 * Scans multiple bookings. Returns only those with violations.
 */
export async function scanMultipleBookings(
  bookingIds: string[],
): Promise<FinancialIntegrityReport[]> {
  const reports = await Promise.all(bookingIds.map(scanBookingIntegrity))
  return reports.filter((r) => !r.passed || r.warnings.length > 0)
}
