/**
 * useFinancialClose — manages financial close runs and history.
 *
 * Persists close records to the financial_closes table.
 * Uses existing close runners (daily/weekly/monthly/manual).
 * Provides export wrappers that call closeExporter.
 */

import { ref, computed } from 'vue'
import { getSupabaseClient } from '@/services/supabaseClient'
import { runDailyClose,   buildDailyPeriod   } from '@/services/financialClose/dailyClose'
import { runWeeklyClose,  buildWeeklyPeriod  } from '@/services/financialClose/weeklyClose'
import { runMonthlyClose, buildMonthlyPeriod, getPreviousMonthArgs } from '@/services/financialClose/monthlyClose'
import { buildPeriodSnapshot } from '@/services/financialClose/financialSnapshot'
import { runPeriodReconciliation } from '@/services/financialClose/reconciliationEngine'
import { validateClose } from '@/services/financialClose/closeValidator'
import {
  exportCloseAsCSV,
  exportDiscrepanciesAsCSV,
  exportCloseAsJSON,
  printCloseAsPDF,
} from '@/services/financialClose/closeExporter'
import type {
  StoredFinancialClose,
  ClosePeriodType,
  CloseStatus,
  FinancialCloseReport,
  ClosePeriod,
} from '@/services/financialClose/types'

export type { StoredFinancialClose, ClosePeriodType, CloseStatus }

export function useFinancialClose() {
  const supabase = getSupabaseClient()

  const history      = ref<StoredFinancialClose[]>([])
  const running      = ref(false)
  const runError     = ref<string | null>(null)
  const loadingHistory = ref(false)

  const selectedClose  = ref<StoredFinancialClose | null>(null)

  // ── History ────────────────────────────────────────────────────────────────

  async function fetchHistory(limit = 50): Promise<void> {
    loadingHistory.value = true
    const { data, error } = await supabase
      .from('financial_closes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    loadingHistory.value = false
    if (error) { console.error('[useFinancialClose] fetchHistory', error); return }
    history.value = (data ?? []).map(mapRow)
  }

  // ── Run close ──────────────────────────────────────────────────────────────

  async function runClose(
    periodType: ClosePeriodType,
    dateOrRange?: Date | { start: Date; end: Date },
  ): Promise<StoredFinancialClose | null> {
    running.value  = true
    runError.value = null

    // Insert a 'running' row so the UI shows progress immediately
    const { data: { user } } = await supabase.auth.getUser()
    let period: ClosePeriod
    if (periodType === 'daily') {
      period = buildDailyPeriod(dateOrRange instanceof Date ? dateOrRange : new Date())
    } else if (periodType === 'weekly') {
      period = buildWeeklyPeriod(dateOrRange instanceof Date ? dateOrRange : new Date())
    } else if (periodType === 'monthly') {
      const { year, month } = getPreviousMonthArgs()
      period = buildMonthlyPeriod(year, month)
    } else {
      // manual — dateOrRange must be { start, end }
      const range = dateOrRange as { start: Date; end: Date }
      period = {
        type:  'manual',
        start: range.start,
        end:   range.end,
        label: `${range.start.toISOString().slice(0, 10)} → ${range.end.toISOString().slice(0, 10)}`,
      }
    }

    // Check for existing close for this period
    const { data: existingRows } = await supabase
      .from('financial_closes')
      .select('id')
      .eq('period_start', period.start.toISOString())
      .eq('period_end',   period.end.toISOString())
      .eq('status',       'complete')
      .limit(1)

    const isRerun = !!(existingRows ?? []).length

    const { data: insertedRow } = await supabase
      .from('financial_closes')
      .insert({
        period_type:  periodType,
        period_start: period.start.toISOString(),
        period_end:   period.end.toISOString(),
        status:       'running',
        created_by:   user?.id ?? null,
        is_rerun:     isRerun,
      })
      .select()
      .single()

    if (!insertedRow) {
      runError.value = 'Failed to create close record'
      running.value  = false
      return null
    }

    const closeId = insertedRow.id

    try {
      let report: FinancialCloseReport
      if (periodType === 'daily') {
        report = await runDailyClose(period.start)
      } else if (periodType === 'weekly') {
        report = await runWeeklyClose(period.start)
      } else if (periodType === 'monthly') {
        const { year, month } = getPreviousMonthArgs()
        report = await runMonthlyClose(year, month)
      } else {
        // manual
        const snapshot       = await buildPeriodSnapshot(period)
        const reconciliation = await runPeriodReconciliation(snapshot.bookingIds)
        const validation     = validateClose(snapshot, reconciliation)
        report = {
          periodType:  'manual',
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

      const newStatus = report.canClose ? 'complete' : 'blocked'
      const { data: updatedRow } = await supabase
        .from('financial_closes')
        .update({
          status:       newStatus,
          report:       report,
          completed_at: new Date().toISOString(),
        })
        .eq('id', closeId)
        .select()
        .single()

      await fetchHistory()
      const stored = updatedRow ? mapRow(updatedRow) : null
      if (stored) selectedClose.value = stored
      return stored
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      runError.value = msg
      await supabase
        .from('financial_closes')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', closeId)
      await fetchHistory()
      return null
    } finally {
      running.value = false
    }
  }

  // ── Exports ────────────────────────────────────────────────────────────────

  function downloadCSV(close: StoredFinancialClose): void   { exportCloseAsCSV(close) }
  function downloadJSON(close: StoredFinancialClose): void  { exportCloseAsJSON(close) }
  function downloadDiscrepanciesCSV(close: StoredFinancialClose): void { exportDiscrepanciesAsCSV(close) }
  function printPDF(close: StoredFinancialClose): void      { printCloseAsPDF(close) }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const latestComplete = computed(() =>
    history.value.find((c) => c.status === 'complete'),
  )

  return {
    history,
    running,
    runError,
    loadingHistory,
    selectedClose,
    latestComplete,
    fetchHistory,
    runClose,
    downloadCSV,
    downloadJSON,
    downloadDiscrepanciesCSV,
    printPDF,
  }
}

// ── Row mapper ─────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): StoredFinancialClose {
  return {
    id:          row.id as string,
    periodType:  row.period_type as StoredFinancialClose['periodType'],
    periodStart: row.period_start as string,
    periodEnd:   row.period_end   as string,
    status:      row.status       as StoredFinancialClose['status'],
    report:      row.report       as StoredFinancialClose['report'] ?? null,
    createdBy:   row.created_by   as string | null,
    createdAt:   row.created_at   as string,
    completedAt: row.completed_at as string | null,
    isRerun:     Boolean(row.is_rerun),
  }
}
