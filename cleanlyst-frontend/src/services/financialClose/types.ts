/**
 * Financial Close — shared TypeScript types.
 *
 * All period-end calculations produce a FinancialCloseReport.
 * StoredFinancialClose is the row shape from the financial_closes table.
 */

export type ClosePeriodType = 'daily' | 'weekly' | 'monthly' | 'manual'
export type CloseStatus = 'open' | 'running' | 'complete' | 'blocked' | 'failed'

export interface ClosePeriod {
  type:   ClosePeriodType
  start:  Date
  end:    Date
  label:  string
}

// ── Reconciliation summary embedded in the report ─────────────────────────────

export interface CloseReconciliationSummary {
  totalBookingsScanned:     number
  ledgerMismatches:         number
  integrityViolations:      number
  duplicateStripeEvents:    number
  orphanPayments:           number
  missingCaptures:          number
  missingPayouts:           number
  missingLedgerEntries:     string[]   // stripe_event_ids
  duplicatedCaptureBookings: string[]  // booking_ids with >1 PAYMENT_CAPTURED
  hasMismatch:              boolean
}

// ── Per-booking discrepancy ───────────────────────────────────────────────────

export interface CloseDiscrepancy {
  bookingId:   string
  type:        string
  description: string
  severity:    'warning' | 'violation'
}

// ── Cash position ─────────────────────────────────────────────────────────────

export interface CloseTotals {
  cashReceivedCents:    number   // total captured payments in period
  cashPaidOutCents:     number   // total released payouts in period
  ledgerBalanceCents:   number   // cashReceived - cashPaidOut - refunds
  outstandingCents:     number   // authorized but not yet captured
  refundLiabilityCents: number   // refund total issued
  pendingLiabilityCents: number  // pending payouts not yet released
}

// ── Main close report ─────────────────────────────────────────────────────────

export interface FinancialCloseReport {
  periodType:  ClosePeriodType
  periodStart: string
  periodEnd:   string
  generatedAt: string

  // Booking counts
  bookingsCreated:    number
  bookingsCompleted:  number
  bookingsCancelled:  number

  // Payment counts
  authorizedPayments: number
  capturedPayments:   number
  refundedPayments:   number
  partialRefunds:     number
  failedPayments:     number

  // Revenue (all in pence)
  grossRevenueCents:         number  // total from payments.amount_cents
  platformRevenueCents:      number  // sum of booking_financials.platform_revenue_cents
  cleanerPayoutsCents:       number  // sum of booking_financials.cleaner_payout_cents
  totalRefundsCents:         number  // sum of payment_ledger_events PAYMENT_REFUNDED
  netRevenueCents:           number  // platformRevenue - refunds
  estimatedStripeFeesCents:  number  // ~2.9% of captured + 30p per transaction

  // Outstanding items
  pendingAuthorizationCount:  number
  outstandingPayoutsCents:    number
  completedPayoutsCents:      number

  // Reconciliation
  reconciliation: CloseReconciliationSummary

  // Per-booking discrepancies
  discrepancies: CloseDiscrepancy[]

  // Validation
  canClose:      boolean
  blockingIssues: string[]
  warnings:       string[]

  // Cash position
  totals: CloseTotals
}

// ── Stored row ────────────────────────────────────────────────────────────────

export interface StoredFinancialClose {
  id:          string
  periodType:  ClosePeriodType
  periodStart: string
  periodEnd:   string
  status:      CloseStatus
  report:      FinancialCloseReport | null
  createdBy:   string | null
  createdAt:   string
  completedAt: string | null
  isRerun:     boolean
}

// ── Period booking row fetched from DB ────────────────────────────────────────

export interface PeriodBookingRow {
  id:                  string
  status:              string
  payment_status:      string | null
  created_at:          string
  completed_at:        string | null
  cancelled_at:        string | null
  quote_cents:         number | null
  cleaner_payout_cents: number | null
}
