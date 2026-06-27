/**
 * dailyClose — builds a FinancialCloseReport for a single calendar day.
 *
 * Period: 00:00:00 → 23:59:59 UTC on the given date.
 * Delegates all data work to financialSnapshot and reconciliationEngine.
 */

import { buildPeriodSnapshot }     from './financialSnapshot'
import { runPeriodReconciliation } from './reconciliationEngine'
import { validateClose }           from './closeValidator'
import type { FinancialCloseReport, ClosePeriod } from './types'

export function buildDailyPeriod(date: Date): ClosePeriod {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    type:  'daily',
    start,
    end,
    label: start.toISOString().slice(0, 10),
  }
}

export async function runDailyClose(date: Date): Promise<FinancialCloseReport> {
  const period        = buildDailyPeriod(date)
  const snapshot      = await buildPeriodSnapshot(period)
  const reconciliation = await runPeriodReconciliation(snapshot.bookingIds)
  const validation    = validateClose(snapshot, reconciliation)

  return {
    periodType:  'daily',
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
