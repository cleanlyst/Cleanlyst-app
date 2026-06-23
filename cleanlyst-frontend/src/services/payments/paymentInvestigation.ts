/**
 * paymentInvestigation — complete investigation bundle for a booking.
 *
 * Aggregates every financial artifact for a booking into a single response
 * so support staff can resolve disputes without querying multiple sources.
 *
 * Includes:
 *   - Booking summary (status, customer, cleaner, schedule)
 *   - All ledger events
 *   - All Stripe IDs (payment intent, checkout session, charge, transfer)
 *   - Payment row
 *   - Payout row
 *   - Chronological timeline
 *   - Integrity report
 *   - Anomaly reports
 *
 * Pure read. No writes.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { getLedgerEvents, getPaymentState, type LedgerEvent, type DerivedPaymentState } from './paymentLedgerResolver'
import { buildPaymentTimeline, type TimelineEntry } from './paymentTimeline'
import { scanBookingIntegrity, type FinancialIntegrityReport } from './financialIntegrityScanner'
import { detectBookingAnomalies, type AnomalyReport } from './paymentAnomalyDetector'
import { reconcileBooking, type ReconciliationReport } from './ledgerReconciliationService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingSummary {
  id:             string
  status:         string | null
  paymentStatus:  string | null
  customerId:     string | null
  cleanerId:      string | null
  scheduledStart: string | null
  scheduledEnd:   string | null
  createdAt:      string | null
  completedAt:    string | null
  amountCents:    number | null
  currency:       string | null
}

export interface PaymentRecord {
  id:                      string | null
  status:                  string | null
  amountCents:             number | null
  currency:                string | null
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId:   string | null
  stripeChargeId:          string | null
  authorizedAt:            string | null
  capturedAt:              string | null
  refundedAt:              string | null
}

export interface PayoutRecord {
  id:               string | null
  status:           string | null
  amountCents:      number | null
  stripeTransferId: string | null
  releasedAt:       string | null
  cleanerId:        string | null
}

export interface InvestigationBundle {
  bookingId:           string
  generatedAt:         string
  booking:             BookingSummary
  derivedPaymentState: DerivedPaymentState
  ledgerEvents:        LedgerEvent[]
  payment:             PaymentRecord
  payout:              PayoutRecord
  timeline:            TimelineEntry[]
  integrity:           FinancialIntegrityReport
  anomalies:           AnomalyReport[]
  reconciliation:      ReconciliationReport
  stripeIds: {
    paymentIntentId:     string | null
    checkoutSessionId:   string | null
    chargeId:            string | null
    transferId:          string | null
  }
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchBookingSummary(bookingId: string): Promise<BookingSummary> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select(
      'id, status, payment_status, customer_id, cleaner_id, scheduled_start, scheduled_end, created_at, completed_at, payments(amount_cents, currency)',
    )
    .eq('id', bookingId)
    .maybeSingle()

  const payment = (data as { payments?: { amount_cents?: number; currency?: string } | null } | null)?.payments

  return {
    id:             data?.id ?? bookingId,
    status:         data?.status ?? null,
    paymentStatus:  data?.payment_status ?? null,
    customerId:     data?.customer_id ?? null,
    cleanerId:      data?.cleaner_id ?? null,
    scheduledStart: data?.scheduled_start ?? null,
    scheduledEnd:   data?.scheduled_end ?? null,
    createdAt:      data?.created_at ?? null,
    completedAt:    data?.completed_at ?? null,
    amountCents:    payment?.amount_cents ?? null,
    currency:       payment?.currency ?? null,
  }
}

async function fetchPaymentRecord(bookingId: string): Promise<PaymentRecord> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('payments')
    .select(
      'id, status, amount_cents, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, authorized_at, captured_at, refunded_at',
    )
    .eq('booking_id', bookingId)
    .maybeSingle()

  return {
    id:                      data?.id ?? null,
    status:                  data?.status ?? null,
    amountCents:             data?.amount_cents ?? null,
    currency:                data?.currency ?? null,
    stripeCheckoutSessionId: data?.stripe_checkout_session_id ?? null,
    stripePaymentIntentId:   data?.stripe_payment_intent_id ?? null,
    stripeChargeId:          data?.stripe_charge_id ?? null,
    authorizedAt:            data?.authorized_at ?? null,
    capturedAt:              data?.captured_at ?? null,
    refundedAt:              data?.refunded_at ?? null,
  }
}

async function fetchPayoutRecord(bookingId: string): Promise<PayoutRecord> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('payouts')
    .select('id, status, amount_cents, stripe_transfer_id, released_at, cleaner_id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  return {
    id:               data?.id ?? null,
    status:           data?.status ?? null,
    amountCents:      data?.amount_cents ?? null,
    stripeTransferId: data?.stripe_transfer_id ?? null,
    releasedAt:       data?.released_at ?? null,
    cleanerId:        data?.cleaner_id ?? null,
  }
}

// ─── Main investigation function ──────────────────────────────────────────────

/**
 * Returns the complete investigation bundle for a booking.
 * All data fetches run in parallel for performance.
 * No writes performed.
 */
export async function investigateBooking(bookingId: string): Promise<InvestigationBundle> {
  const [
    booking,
    ledgerEvents,
    derivedPaymentState,
    payment,
    payout,
    timeline,
    integrity,
    anomalies,
    reconciliation,
  ] = await Promise.all([
    fetchBookingSummary(bookingId),
    getLedgerEvents(bookingId),
    getPaymentState(bookingId),
    fetchPaymentRecord(bookingId),
    fetchPayoutRecord(bookingId),
    buildPaymentTimeline(bookingId),
    scanBookingIntegrity(bookingId),
    detectBookingAnomalies(bookingId),
    reconcileBooking(bookingId),
  ])

  // Aggregate all known Stripe IDs from ledger + payment row
  const stripeIds = {
    paymentIntentId:   payment.stripePaymentIntentId
      ?? ledgerEvents.find((e) => e.stripePaymentIntentId)?.stripePaymentIntentId
      ?? null,
    checkoutSessionId: payment.stripeCheckoutSessionId ?? null,
    chargeId:          payment.stripeChargeId ?? null,
    transferId:        payout.stripeTransferId
      ?? ledgerEvents.find((e) => e.stripeTransferId)?.stripeTransferId
      ?? null,
  }

  return {
    bookingId,
    generatedAt: new Date().toISOString(),
    booking,
    derivedPaymentState,
    ledgerEvents,
    payment,
    payout,
    timeline,
    integrity,
    anomalies,
    reconciliation,
    stripeIds,
  }
}
