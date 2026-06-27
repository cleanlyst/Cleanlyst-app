/**
 * monthlyClose — builds a FinancialCloseReport for a full calendar month.
 *
 * Period: 1st of month 00:00 UTC → 1st of next month 00:00 UTC.
 */

import { buildPeriodSnapshot }     from './financialSnapshot'
import { runPeriodReconciliation } from './reconciliationEngine'
import { validateClose }           from './closeValidator'
import type { FinancialCloseReport, ClosePeriod } from './types'

export function buildMonthlyPeriod(year: number, month: number): ClosePeriod {
  // month: 1-based (1=January)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end   = new Date(Date.UTC(year, month, 1))
  const label = start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { type: 'monthly', start, end, label }
}

export async function runMonthlyClose(year: number, month: number): Promise<FinancialCloseReport> {
  const period         = buildMonthlyPeriod(year, month)
  const snapshot       = await buildPeriodSnapshot(period)
  const reconciliation = await runPeriodReconciliation(snapshot.bookingIds)
  const validation     = validateClose(snapshot, reconciliation)

  return {
    periodType:  'monthly',
    periodStart: period.start.toISOString(),
    periodEnd:   period.end.toISOString(),
    generatedAt: new Date().toISOString(),
    bookingsCreated:    snapshot.bookingsCreated,
    bookingsCompleted:  snapshot.bookingsCompleted,
    bookingsCancelled:  snapshot.bookingsCancelled,
    authorizedPayments: snapshot.authorizedPayments,
    capturedPayments:   snapshot.capturedPayments,
    refundedPayments:   snapshot.refundedPayments,
    partialRefunds:     snapshot.partialRefunds,
    failedPayments:     snapshot.failedPayments,
    grossRevenueCents:         snapshot.grossRevenueCents,
    platformRevenueCents:      snapshot.platformRevenueCents,
    cleanerPayoutsCents:       snapshot.cleanerPayoutsCents,
    totalRefundsCents:         snapshot.totalRefundsCents,
    netRevenueCents:           snapshot.netRevenueCents,
    estimatedStripeFeesCents:  snapshot.estimatedStripeFeesCents,
    pendingAuthorizationCount: snapshot.pendingAuthorizationCount,
    outstandingPayoutsCents:   snapshot.outstandingPayoutsCents,
    completedPayoutsCents:     snapshot.completedPayoutsCents,
    reconciliation: reconciliation.summary,
    discrepancies:  reconciliation.discrepancies,
    canClose:       validation.canClose,
    blockingIssues: validation.blockingIssues,
    warnings:       validation.warnings,
    totals: {
      cashReceivedCents:    snapshot.grossRevenueCents,
      cashPaidOutCents:     snapshot.completedPayoutsCents + snapshot.totalRefundsCents,
      ledgerBalanceCents:   Math.max(0, snapshot.grossRevenueCents - snapshot.completedPayoutsCents - snapshot.totalRefundsCents),
      outstandingCents:     0,
      refundLiabilityCents: snapshot.totalRefundsCents,
      pendingLiabilityCents: snapshot.outstandingPayoutsCents,
    },
  }
}

/** Convenience: run close for the previous complete calendar month. */
export function getPreviousMonthArgs(): { year: number; month: number } {
  const now = new Date()
  const m   = now.getUTCMonth() // 0-based
  return m === 0
    ? { year: now.getUTCFullYear() - 1, month: 12 }
    : { year: now.getUTCFullYear(), month: m }
}
