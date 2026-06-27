/**
 * weeklyClose — builds a FinancialCloseReport for a Monday→Sunday week.
 *
 * Period: Monday 00:00 UTC → following Monday 00:00 UTC.
 */

import { buildPeriodSnapshot }     from './financialSnapshot'
import { runPeriodReconciliation } from './reconciliationEngine'
import { validateClose }           from './closeValidator'
import type { FinancialCloseReport, ClosePeriod } from './types'

/** Returns the Monday of the week containing `date` (UTC). */
export function getWeekStart(date: Date): Date {
  const d   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0=Sun 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  return new Date(d.getTime() + diff * 24 * 60 * 60 * 1000)
}

export function buildWeeklyPeriod(date: Date): ClosePeriod {
  const start = getWeekStart(date)
  const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  const label = `W/C ${start.toISOString().slice(0, 10)}`
  return { type: 'weekly', start, end, label }
}

export async function runWeeklyClose(date: Date): Promise<FinancialCloseReport> {
  const period         = buildWeeklyPeriod(date)
  const snapshot       = await buildPeriodSnapshot(period)
  const reconciliation = await runPeriodReconciliation(snapshot.bookingIds)
  const validation     = validateClose(snapshot, reconciliation)

  return {
    periodType:  'weekly',
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
