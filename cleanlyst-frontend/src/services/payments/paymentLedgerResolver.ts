/**
 * paymentLedgerResolver — derives financial state from payment_ledger_events.
 *
 * INVARIANTS:
 *   - MUST NOT read bookings.payment_status for any financial decision
 *   - MUST query payment_ledger_events as the authoritative source
 *   - Pure derivation — no mutations, no side effects
 *
 * Usage:
 *   const state  = await getPaymentState(bookingId)
 *   const events = await getLedgerEvents(bookingId)
 */

import { getSupabaseClient } from '@/services/supabaseClient'

export type LedgerEventType =
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_REFUNDED'
  | 'PAYOUT_RELEASED'
  | 'PAYOUT_REVERSED'
  | 'ESTIMATE_ADJUSTMENT_REQUESTED'
  | 'ESTIMATE_ADJUSTMENT_ACCEPTED'
  | 'ESTIMATE_ADJUSTMENT_REJECTED'
  | 'ADDITIONAL_PAYMENT_AUTHORIZED'

export type DerivedPaymentState = 'unpaid' | 'authorized' | 'captured' | 'refunded'

export interface LedgerEvent {
  id: string
  bookingId: string
  eventType: LedgerEventType
  amountCents: number | null
  currency: string
  stripeEventId: string
  stripePaymentIntentId: string | null
  stripeTransferId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

/** Derives payment state from ledger events in priority order: REFUNDED > CAPTURED > AUTHORIZED > unpaid. */
export function deriveStateFromEvents(events: LedgerEvent[]): DerivedPaymentState {
  if (events.some((e) => e.eventType === 'PAYMENT_REFUNDED')) return 'refunded'
  if (events.some((e) => e.eventType === 'PAYMENT_CAPTURED')) return 'captured'
  if (events.some((e) => e.eventType === 'PAYMENT_AUTHORIZED')) return 'authorized'
  return 'unpaid'
}

/** Fetches all ledger events for a booking and derives the authoritative payment state. */
export async function getPaymentState(bookingId: string): Promise<DerivedPaymentState> {
  const events = await getLedgerEvents(bookingId)
  return deriveStateFromEvents(events)
}

/** Returns all ledger events for a booking, ordered oldest-first. */
export async function getLedgerEvents(bookingId: string): Promise<LedgerEvent[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('payment_ledger_events')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[paymentLedgerResolver] failed to fetch ledger events', { bookingId, error })
    return []
  }

  return (data ?? []).map((row) => ({
    id:                    row.id,
    bookingId:             row.booking_id,
    eventType:             row.event_type as LedgerEventType,
    amountCents:           row.amount_cents ?? null,
    currency:              row.currency,
    stripeEventId:         row.stripe_event_id,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeTransferId:      row.stripe_transfer_id ?? null,
    metadata:              (row.metadata ?? {}) as Record<string, unknown>,
    createdAt:             row.created_at,
  }))
}

/** Returns true if the ledger confirms payment has been captured (payout-eligible). */
export async function isPaymentCaptured(bookingId: string): Promise<boolean> {
  return (await getPaymentState(bookingId)) === 'captured'
}

/** Returns true if the ledger confirms a refund has been issued. */
export async function isPaymentRefunded(bookingId: string): Promise<boolean> {
  return (await getPaymentState(bookingId)) === 'refunded'
}
