/**
 * idempotencyValidator — verifies no financial operation was processed twice.
 *
 * Checks:
 *   - Every Stripe event processed exactly once (payment_webhook_events)
 *   - No duplicate PAYMENT_CAPTURED in ledger for a booking
 *   - No duplicate PAYMENT_REFUNDED in ledger for a booking
 *   - No duplicate PAYOUT_RELEASED in ledger for a booking
 *   - No payout row created more than once for a booking
 *
 * Pure read. No writes.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { getLedgerEvents } from './paymentLedgerResolver'
import { log } from './financialLogger'

export interface IdempotencyViolation {
  type:      'DUPLICATE_WEBHOOK' | 'DUPLICATE_CAPTURE' | 'DUPLICATE_REFUND' | 'DUPLICATE_PAYOUT' | 'DUPLICATE_LEDGER_EVENT'
  detail:    string
  metadata:  Record<string, unknown>
}

export interface IdempotencyReport {
  bookingId?:       string
  stripeEventId?:   string
  valid:            boolean
  violations:       IdempotencyViolation[]
  checkedAt:        string
}

export interface GlobalIdempotencyReport {
  checkedAt:              string
  valid:                  boolean
  duplicateWebhookEvents: string[]
  summary:                string
}

// ─── Per-booking idempotency ──────────────────────────────────────────────────

/**
 * Verifies that all financial operations for a booking were processed exactly once.
 */
export async function validateBookingIdempotency(bookingId: string): Promise<IdempotencyReport> {
  const supabase = getSupabaseClient()
  const violations: IdempotencyViolation[] = []

  const [events, payoutResult] = await Promise.all([
    getLedgerEvents(bookingId),
    supabase
      .from('payouts')
      .select('id, status, created_at')
      .eq('booking_id', bookingId),
  ])

  const captured = events.filter((e) => e.eventType === 'PAYMENT_CAPTURED')
  const refunded = events.filter((e) => e.eventType === 'PAYMENT_REFUNDED')
  const payouts  = events.filter((e) => e.eventType === 'PAYOUT_RELEASED')

  // ── Duplicate captures ─────────────────────────────────────────────────────
  if (captured.length > 1) {
    violations.push({
      type:    'DUPLICATE_CAPTURE',
      detail:  `${captured.length} PAYMENT_CAPTURED events for booking ${bookingId}`,
      metadata: {
        captureCount:    captured.length,
        stripeEventIds:  captured.map((e) => e.stripeEventId),
      },
    })
  }

  // ── Duplicate refunds ──────────────────────────────────────────────────────
  if (refunded.length > 1) {
    violations.push({
      type:    'DUPLICATE_REFUND',
      detail:  `${refunded.length} PAYMENT_REFUNDED events for booking ${bookingId}`,
      metadata: {
        refundCount:     refunded.length,
        stripeEventIds:  refunded.map((e) => e.stripeEventId),
        totalRefundedCents: refunded.reduce((s, e) => s + (e.amountCents ?? 0), 0),
      },
    })
  }

  // ── Duplicate payout ledger events ─────────────────────────────────────────
  if (payouts.length > 1) {
    violations.push({
      type:    'DUPLICATE_PAYOUT',
      detail:  `${payouts.length} PAYOUT_RELEASED events for booking ${bookingId}`,
      metadata: {
        payoutCount:      payouts.length,
        transferIds:      payouts.map((e) => e.stripeTransferId),
      },
    })
  }

  // ── Duplicate payout DB rows ───────────────────────────────────────────────
  const payoutRows = payoutResult.data ?? []
  if (payoutRows.length > 1) {
    violations.push({
      type:    'DUPLICATE_PAYOUT',
      detail:  `${payoutRows.length} payout rows exist in payouts table for booking ${bookingId}`,
      metadata: { payoutRows },
    })
  }

  // ── Duplicate stripe_event_ids in ledger ───────────────────────────────────
  const seenIds = new Map<string, number>()
  for (const e of events) {
    seenIds.set(e.stripeEventId, (seenIds.get(e.stripeEventId) ?? 0) + 1)
  }
  for (const [stripeEventId, count] of seenIds) {
    if (count > 1) {
      violations.push({
        type:    'DUPLICATE_LEDGER_EVENT',
        detail:  `stripe_event_id "${stripeEventId}" appears ${count} times in ledger`,
        metadata: { stripeEventId, count },
      })
    }
  }

  const valid = violations.length === 0

  if (!valid) {
    for (const v of violations) {
      log.idempotencyViolation(v.metadata.stripeEventIds?.[0] as string ?? '', {
        bookingId,
        violationType: v.type,
        detail: v.detail,
      })
    }
  }

  return {
    bookingId,
    valid,
    violations,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Verifies that a specific Stripe event was processed exactly once.
 */
export async function validateWebhookIdempotency(stripeEventId: string): Promise<IdempotencyReport> {
  const supabase = getSupabaseClient()
  const violations: IdempotencyViolation[] = []

  const { data } = await supabase
    .from('payment_webhook_events')
    .select('id, stripe_event_id, stripe_event_type, processed_at, received_at')
    .eq('stripe_event_id', stripeEventId)

  const rows = data ?? []

  if (rows.length > 1) {
    violations.push({
      type:    'DUPLICATE_WEBHOOK',
      detail:  `stripe_event_id "${stripeEventId}" found ${rows.length} times in payment_webhook_events`,
      metadata: { stripeEventId, count: rows.length, rows },
    })
    log.webhookDuplicate(stripeEventId, { count: rows.length })
  }

  // Check the corresponding ledger entry
  const { data: ledgerRows } = await supabase
    .from('payment_ledger_events')
    .select('id, event_type, booking_id, created_at')
    .eq('stripe_event_id', stripeEventId)

  if ((ledgerRows ?? []).length > 1) {
    violations.push({
      type:    'DUPLICATE_LEDGER_EVENT',
      detail:  `stripe_event_id "${stripeEventId}" found ${ledgerRows!.length} times in payment_ledger_events — UNIQUE constraint may have been bypassed`,
      metadata: { stripeEventId, count: ledgerRows!.length },
    })
  }

  return {
    stripeEventId,
    valid:     violations.length === 0,
    violations,
    checkedAt: new Date().toISOString(),
  }
}

// ─── Global idempotency scan ──────────────────────────────────────────────────

/**
 * Scans all recent webhook events for duplicates.
 * Checks that the UNIQUE constraint on payment_webhook_events.stripe_event_id is holding.
 */
export async function validateGlobalWebhookIdempotency(options: {
  limit?: number
} = {}): Promise<GlobalIdempotencyReport> {
  const supabase = getSupabaseClient()
  const limit = options.limit ?? 500

  const { data } = await supabase
    .from('payment_webhook_events')
    .select('stripe_event_id, processed_at')
    .order('received_at', { ascending: false })
    .limit(limit)

  const rows = (data ?? []) as { stripe_event_id: string }[]
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.stripe_event_id, (counts.get(row.stripe_event_id) ?? 0) + 1)
  }

  const duplicateWebhookEvents = [...counts.entries()]
    .filter(([, c]) => c > 1)
    .map(([id]) => id)

  const valid = duplicateWebhookEvents.length === 0

  return {
    checkedAt:              new Date().toISOString(),
    valid,
    duplicateWebhookEvents,
    summary: valid
      ? `All ${rows.length} recent webhook events are unique.`
      : `Found ${duplicateWebhookEvents.length} duplicate webhook event(s) in last ${rows.length} events.`,
  }
}
