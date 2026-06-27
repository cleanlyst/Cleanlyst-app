/**
 * reconciliationEngine — orchestrates all reconciliation checks for a close period.
 *
 * Reuses existing scanners — never duplicates logic:
 *   scanMultipleBookings()     from financialIntegrityScanner
 *   reconcileMultipleBookings() from ledgerReconciliationService
 *   compareStripeToLedger()    from ledgerReconciliationService
 *
 * Pure read. No writes.
 */

import { scanMultipleBookings }      from '@/services/payments/financialIntegrityScanner'
import {
  reconcileMultipleBookings,
  compareStripeToLedger,
}                                    from '@/services/payments/ledgerReconciliationService'
import type { CloseReconciliationSummary, CloseDiscrepancy } from './types'

export interface ReconciliationEngineResult {
  summary:      CloseReconciliationSummary
  discrepancies: CloseDiscrepancy[]
}

/**
 * Runs all reconciliation checks for bookings in the period in parallel.
 * Expensive for large volumes — call sparingly (close time only).
 */
export async function runPeriodReconciliation(
  bookingIds: string[],
): Promise<ReconciliationEngineResult> {
  if (!bookingIds.length) {
    return {
      summary: {
        totalBookingsScanned:      0,
        ledgerMismatches:          0,
        integrityViolations:       0,
        duplicateStripeEvents:     0,
        orphanPayments:            0,
        missingCaptures:           0,
        missingPayouts:            0,
        missingLedgerEntries:      [],
        duplicatedCaptureBookings: [],
        hasMismatch:               false,
      },
      discrepancies: [],
    }
  }

  const [integrityReports, reconciliationReports, stripeToLedger] = await Promise.all([
    scanMultipleBookings(bookingIds),
    reconcileMultipleBookings(bookingIds),
    compareStripeToLedger({ limit: 2000 }),
  ])

  const discrepancies: CloseDiscrepancy[] = []

  // Integrity violations → violations
  for (const report of integrityReports) {
    for (const v of report.violations) {
      discrepancies.push({
        bookingId:   report.bookingId,
        type:        'integrity_violation',
        description: v,
        severity:    'violation',
      })
    }
    for (const w of report.warnings) {
      discrepancies.push({
        bookingId:   report.bookingId,
        type:        'integrity_warning',
        description: w,
        severity:    'warning',
      })
    }
  }

  // Ledger mismatches → violations
  for (const report of reconciliationReports) {
    for (const m of report.mismatches) {
      discrepancies.push({
        bookingId:   report.bookingId,
        type:        'ledger_mismatch',
        description: m,
        severity:    'violation',
      })
    }
  }

  // Stripe-to-ledger issues → violations
  for (const id of stripeToLedger.missingFromLedger) {
    discrepancies.push({
      bookingId:   '—',
      type:        'missing_ledger_entry',
      description: `Stripe event ${id} was processed but has no ledger entry`,
      severity:    'violation',
    })
  }

  for (const bookingId of stripeToLedger.duplicatedCaptures) {
    discrepancies.push({
      bookingId,
      type:        'duplicate_capture',
      description: `Booking has more than one PAYMENT_CAPTURED ledger event`,
      severity:    'violation',
    })
  }

  const summary: CloseReconciliationSummary = {
    totalBookingsScanned:      bookingIds.length,
    ledgerMismatches:          reconciliationReports.length,
    integrityViolations:       integrityReports.filter((r) => r.violations.length > 0).length,
    duplicateStripeEvents:     stripeToLedger.duplicatedCaptures.length,
    orphanPayments:            stripeToLedger.orphanLedgerEvents.length,
    missingCaptures:           0, // derived by closeValidator from snapshot
    missingPayouts:            0,
    missingLedgerEntries:      stripeToLedger.missingFromLedger,
    duplicatedCaptureBookings: stripeToLedger.duplicatedCaptures,
    hasMismatch:               discrepancies.filter((d) => d.severity === 'violation').length > 0,
  }

  return { summary, discrepancies }
}
