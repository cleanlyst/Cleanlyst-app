import { describe, expect, it } from 'vitest'
import { deriveStateFromEvents } from '@/services/payments/paymentLedgerResolver'
import {
  emptyEvents,
  authOnlyEvents,
  normalPaymentEvents,
  fullRefundEvents,
  makeAuthorized,
  makeCaptured,
  makeRefunded,
  makePayoutReleased,
  resetSeq,
} from '../fixtures/ledgerFactory'

describe('deriveStateFromEvents()', () => {
  it('returns unpaid for an empty event list', () => {
    expect(deriveStateFromEvents(emptyEvents())).toBe('unpaid')
  })

  it('returns authorized when only PAYMENT_AUTHORIZED is present', () => {
    expect(deriveStateFromEvents(authOnlyEvents())).toBe('authorized')
  })

  it('returns captured for auth + capture', () => {
    resetSeq()
    expect(deriveStateFromEvents([makeAuthorized(), makeCaptured()])).toBe('captured')
  })

  it('returns captured for full happy-path (auth, capture, payout)', () => {
    expect(deriveStateFromEvents(normalPaymentEvents())).toBe('captured')
  })

  it('returns refunded when PAYMENT_REFUNDED is present regardless of capture', () => {
    expect(deriveStateFromEvents(fullRefundEvents())).toBe('refunded')
  })

  it('REFUNDED supersedes CAPTURED — refund wins', () => {
    resetSeq()
    const events = [makeAuthorized(), makeCaptured(), makeRefunded()]
    expect(deriveStateFromEvents(events)).toBe('refunded')
  })

  it('REFUNDED supersedes AUTHORIZED even without CAPTURED', () => {
    resetSeq()
    const events = [makeAuthorized(), makeRefunded(0)]
    expect(deriveStateFromEvents(events)).toBe('refunded')
  })

  it('PAYOUT_RELEASED alone does not affect payment state', () => {
    resetSeq()
    const events = [makeAuthorized(), makeCaptured(), makePayoutReleased()]
    expect(deriveStateFromEvents(events)).toBe('captured')
  })

  it('is deterministic — same inputs always produce same output', () => {
    const events = fullRefundEvents()
    const r1 = deriveStateFromEvents(events)
    const r2 = deriveStateFromEvents(events)
    expect(r1).toBe(r2)
  })

  it('handles events in any order — priority is based on presence not timestamp', () => {
    resetSeq()
    // Deliberately reversed order
    const events = [makeRefunded(), makeCaptured(), makeAuthorized()]
    expect(deriveStateFromEvents(events)).toBe('refunded')
  })
})
