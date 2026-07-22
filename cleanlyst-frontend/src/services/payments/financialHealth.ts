/**
 * financialHealth — aggregated financial metrics snapshot across all bookings.
 *
 * Powers admin dashboards and operational health checks.
 * All values are derived from the ledger + projection tables.
 * Pure read. No writes.
 *
 * Usage:
 *   const snapshot = await getFinancialHealthSnapshot()
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { log } from './financialLogger'

export interface FinancialHealthSnapshot {
  generatedAt:            string
  totalLedgerEvents:      number
  totalPayments:          number
  capturedPayments:       number
  refundedPayments:       number
  pendingAuthorizations:  number
  totalRefundAmountCents: number
  totalCapturedAmountCents: number
  pendingPayouts:         number
  releasedPayouts:        number
  failedPayouts:          number
  orphanPayments:         number
  reconciliationFailures: number
  coverageNote:           string
}

/**
 * Builds a financial health snapshot. Queries run in parallel.
 *
 * "orphan payments" = payments table rows whose status is not reflected
 *  by any PAYMENT_CAPTURED ledger event (cache/ledger drift).
 *
 * "reconciliation failures" = ledger events that have no matching processed
 *  payment_webhook_event (indicates a write that bypassed the webhook).
 */
export async function getFinancialHealthSnapshot(): Promise<FinancialHealthSnapshot> {
  const supabase = getSupabaseClient()

  const [
    ledgerResult,
    paymentsResult,
    payoutsResult,
    webhookResult,
  ] = await Promise.all([
    // Ledger event counts and sums by type
    supabase
      .from('payment_ledger_events')
      .select('event_type, amount_cents'),

    // Payment projection state
    supabase
      .from('payments')
      .select('status, amount_cents'),

    // Payout projection state
    supabase
      .from('payouts')
      .select('status'),

    // Webhook event coverage — events that have been processed
    supabase
      .from('payment_webhook_events')
      .select('stripe_event_id, processed_at')
      .not('processed_at', 'is', null),
  ])

  const ledgerRows   = (ledgerResult.data  ?? []) as { event_type: string; amount_cents: number | null }[]
  const paymentRows  = (paymentsResult.data ?? []) as { status: string; amount_cents: number }[]
  const payoutRows   = (payoutsResult.data  ?? []) as { status: string }[]
  const webhookRows  = (webhookResult.data  ?? []) as { stripe_event_id: string }[]

  // ── Ledger metrics ─────────────────────────────────────────────────────────
  const authorized  = ledgerRows.filter((r) => r.event_type === 'PAYMENT_AUTHORIZED')
  const captured    = ledgerRows.filter((r) => r.event_type === 'PAYMENT_CAPTURED')
  const refunded    = ledgerRows.filter((r) => r.event_type === 'PAYMENT_REFUNDED')

  const totalCapturedCents = captured.reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const totalRefundedCents = refunded.reduce((s, r) => s + (r.amount_cents ?? 0), 0)

  // ── Payment projection metrics ────────────────────────────────────────────
  const capturedPayments     = paymentRows.filter((r) => r.status === 'captured').length
  const refundedPayments     = paymentRows.filter((r) => r.status === 'refunded').length
  const pendingAuthorizations = authorized.length - captured.length - refunded.length < 0
    ? 0
    : authorized.length - captured.length - refunded.length

  // ── Orphan payments ────────────────────────────────────────────────────────
  // Payments with status='captured' but no matching ledger PAYMENT_CAPTURED event
  // We can't join at the query level (different tables), so we use counts as a proxy:
  // if captured payments > ledger captures, there are orphan captures.
  const orphanPayments = Math.max(0, capturedPayments - captured.length)

  // ── Payout metrics ─────────────────────────────────────────────────────────
  const pendingPayouts  = payoutRows.filter((r) => r.status === 'pending').length
  const releasedPayouts = payoutRows.filter((r) => r.status === 'paid').length
  const failedPayouts   = payoutRows.filter((r) => r.status === 'reversed').length

  // ── Reconciliation failures ────────────────────────────────────────────────
  // Ledger events that don't correspond to any processed webhook event.
  // Each ledger row must have a stripe_event_id that exists in payment_webhook_events.
  // Full reconciliation is in ledgerReconciliationService.compareStripeToLedger()
  const processedWebhookIds = new Set(webhookRows.map((r) => r.stripe_event_id))

  // Use webhook count vs ledger count as a coarse check
  const processedCount = processedWebhookIds.size
  const ledgerFinancialEventCount = authorized.length + captured.length + refunded.length +
    ledgerRows.filter((r) => r.event_type === 'PAYOUT_RELEASED').length

  const coarseReconciliationFailures = Math.max(0, ledgerFinancialEventCount - processedCount)

  const snapshot: FinancialHealthSnapshot = {
    generatedAt:              new Date().toISOString(),
    totalLedgerEvents:        ledgerRows.length,
    totalPayments:            paymentRows.length,
    capturedPayments:         capturedPayments,
    refundedPayments:         refundedPayments,
    pendingAuthorizations:    pendingAuthorizations,
    totalRefundAmountCents:   totalRefundedCents,
    totalCapturedAmountCents: totalCapturedCents,
    pendingPayouts:           pendingPayouts,
    releasedPayouts:          releasedPayouts,
    failedPayouts:            failedPayouts,
    orphanPayments:           orphanPayments,
    reconciliationFailures:   coarseReconciliationFailures,
    coverageNote:
      'reconciliationFailures is a coarse count — use ledgerReconciliationService.compareStripeToLedger() for exact results',
  }

  if (snapshot.orphanPayments > 0) {
    log.ledgerMismatch('global', `${snapshot.orphanPayments} orphan payment(s) detected`)
  }
  if (snapshot.failedPayouts > 0) {
    log.anomalyDetected('global', 'COMPLETED_PAYOUT_MISSING', { failedPayouts: snapshot.failedPayouts })
  }

  return snapshot
}
