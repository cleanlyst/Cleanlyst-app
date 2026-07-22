/**
 * ledgerFactory — deterministic test data for payment_ledger_events rows.
 *
 * All factories produce structurally valid objects that mirror the DB schema.
 * Use sequence() to create distinct IDs for parallel test runs.
 */

import type { LedgerEvent } from '@/services/payments/paymentLedgerResolver'

let seq = 0
export function resetSeq() { seq = 0 }
function next() { return String(++seq).padStart(5, '0') }

const BASE_TIME = new Date('2026-01-01T10:00:00.000Z')
function ts(offsetMinutes = 0): string {
  return new Date(BASE_TIME.getTime() + offsetMinutes * 60_000).toISOString()
}

export const BOOKING_ID   = '11111111-1111-1111-1111-111111111111'
export const BOOKING_ID_2 = '22222222-2222-2222-2222-222222222222'

export function makeLedgerEvent(overrides: Partial<LedgerEvent> & Pick<LedgerEvent, 'eventType'>): LedgerEvent {
  const n = next()
  return {
    id:                    `ple-${n}`,
    bookingId:             BOOKING_ID,
    amountCents:           10_000,
    currency:              'gbp',
    stripeEventId:         `evt_test_${n}`,
    stripePaymentIntentId: `pi_test_${n}`,
    stripeTransferId:      null,
    metadata:              {},
    createdAt:             ts(Number(n)),
    ...overrides,
  }
}

export function makeAuthorized(overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeLedgerEvent({ eventType: 'PAYMENT_AUTHORIZED', amountCents: 10_000, createdAt: ts(1), stripeEventId: `evt_auth_${next()}`, ...overrides })
}

export function makeCaptured(overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeLedgerEvent({ eventType: 'PAYMENT_CAPTURED', amountCents: 10_000, createdAt: ts(2), stripeEventId: `evt_cap_${next()}`, ...overrides })
}

export function makeRefunded(amountCents = 10_000, overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeLedgerEvent({ eventType: 'PAYMENT_REFUNDED', amountCents, createdAt: ts(5), stripeEventId: `evt_ref_${next()}`, ...overrides })
}

export function makePayoutReleased(overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeLedgerEvent({
    eventType:        'PAYOUT_RELEASED',
    amountCents:      8_500,
    stripeTransferId: `tr_test_${next()}`,
    stripeEventId:    `evt_tr_${next()}`,
    createdAt:        ts(10),
    ...overrides,
  })
}

/** Standard happy-path sequence: auth → capture → payout */
export function normalPaymentEvents(): LedgerEvent[] {
  resetSeq()
  return [makeAuthorized(), makeCaptured(), makePayoutReleased()]
}

/** Auth → captured → refund (no payout) */
export function fullRefundEvents(): LedgerEvent[] {
  resetSeq()
  return [makeAuthorized(), makeCaptured(), makeRefunded(10_000)]
}

/** Auth only — no capture yet */
export function authOnlyEvents(): LedgerEvent[] {
  resetSeq()
  return [makeAuthorized()]
}

/** Empty — no financial events */
export function emptyEvents(): LedgerEvent[] {
  return []
}
