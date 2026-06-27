/**
 * closeValidator — determines whether a period close can proceed.
 *
 * Blocks close if any of the following exist:
 *   - Ledger mismatches
 *   - Duplicate Stripe events
 *   - Financial integrity violations
 *   - Missing ledger entries for processed webhook events
 *   - Duplicate PAYMENT_CAPTURED per booking
 *
 * Warnings do not block; they are surfaced for admin review.
 */

import type { ReconciliationEngineResult } from './reconciliationEngine'
import type { PeriodSnapshot }             from './financialSnapshot'

export interface ValidationResult {
  canClose:      boolean
  blockingIssues: string[]
  warnings:       string[]
}

/**
 * Validates a close against the reconciliation result and period snapshot.
 * Returns blocking issues and non-blocking warnings.
 */
export function validateClose(
  snapshot:       PeriodSnapshot,
  reconciliation: ReconciliationEngineResult,
): ValidationResult {
  const blockingIssues: string[] = []
  const warnings:       string[] = []

  const { summary } = reconciliation

  if (summary.ledgerMismatches > 0) {
    blockingIssues.push(
      `${summary.ledgerMismatches} ledger mismatch(es) detected — bookings.payment_status does not reflect ledger state`,
    )
  }

  if (summary.integrityViolations > 0) {
    blockingIssues.push(
      `${summary.integrityViolations} financial integrity violation(s) detected — review investigation panel for each booking`,
    )
  }

  if (summary.duplicateStripeEvents > 0) {
    blockingIssues.push(
      `${summary.duplicateStripeEvents} booking(s) have duplicate PAYMENT_CAPTURED ledger events`,
    )
  }

  if (summary.missingLedgerEntries.length > 0) {
    blockingIssues.push(
      `${summary.missingLedgerEntries.length} Stripe webhook event(s) processed but missing from ledger`,
    )
  }

  if (snapshot.pendingAuthorizationCount > 0) {
    blockingIssues.push(
      `${snapshot.pendingAuthorizationCount} payment authorization(s) are outstanding (not captured or refunded)`,
    )
  }

  // Warnings — do not block
  if (snapshot.outstandingPayoutsCents > 0) {
    warnings.push(
      `£${(snapshot.outstandingPayoutsCents / 100).toFixed(2)} in payout(s) pending release to cleaners`,
    )
  }

  if (summary.orphanPayments > 0) {
    warnings.push(
      `${summary.orphanPayments} ledger event(s) have no matching webhook event (may be simulation/manual entries)`,
    )
  }

  const discrepancyWarnings = reconciliation.discrepancies
    .filter((d) => d.severity === 'warning')
    .length
  if (discrepancyWarnings > 0) {
    warnings.push(`${discrepancyWarnings} non-blocking reconciliation warning(s) — review before signing off`)
  }

  return {
    canClose: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  }
}
