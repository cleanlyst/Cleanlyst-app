import { describe, expect, it } from 'vitest'
import {
  canStartCleaning,
  canComplete,
  canCancelCustomer,
  cannotAttend,
  isTransitionAllowed,
} from '@/services/bookingLifecycleService'
import {
  makeBooking,
  makePaidBooking,
  makeCompletedBooking,
  makePaymentAuthorizedBooking,
  resetIdSeq,
} from '../fixtures/bookingFactory'
import type { BookingDetailRow } from '@/services/bookingService'

function asDetail(b: ReturnType<typeof makeBooking>): BookingDetailRow {
  return b as unknown as BookingDetailRow
}

describe('canStartCleaning()', () => {
  it('returns false when booking has already started', () => {
    const b = asDetail(makePaidBooking({ started_at: '2026-01-15T09:01:00.000Z' }))
    expect(canStartCleaning(b)).toBe(false)
  })

  it('returns true for payment_authorized status regardless of payment_status', () => {
    const b = asDetail(makePaymentAuthorizedBooking({ payment_status: 'authorized' }))
    expect(canStartCleaning(b)).toBe(true)
  })

  it('returns true for paid booking with captured payment', () => {
    const b = asDetail(makePaidBooking({ payment_status: 'captured' }))
    expect(canStartCleaning(b)).toBe(true)
  })

  it('returns false for accepted booking with uncaptured payment', () => {
    const b = asDetail(makeBooking({ status: 'accepted', payment_status: 'authorized' }))
    expect(canStartCleaning(b)).toBe(false)
  })

  it('returns false for non-startable statuses', () => {
    for (const status of ['pending_request', 'completed', 'cancelled', 'disputed'] as const) {
      const b = asDetail(makeBooking({ status, payment_status: 'captured' }))
      expect(canStartCleaning(b)).toBe(false)
    }
  })

  it('uses derivedPaymentState when provided — ignores booking.payment_status', () => {
    const b = asDetail(makePaidBooking({ payment_status: 'authorized' }))  // cache says authorized
    // derivedPaymentState says captured → should allow start
    expect(canStartCleaning(b, 'captured')).toBe(true)
    // derivedPaymentState says authorized → should block
    expect(canStartCleaning(b, 'authorized')).toBe(false)
  })
})

describe('canComplete()', () => {
  it('returns true only when status is in_progress', () => {
    expect(canComplete(asDetail(makeBooking({ status: 'in_progress' })))).toBe(true)
    expect(canComplete(asDetail(makePaidBooking()))).toBe(false)
    expect(canComplete(asDetail(makeCompletedBooking()))).toBe(false)
  })
})

describe('canCancelCustomer()', () => {
  it('allows cancellation for pre-service statuses', () => {
    for (const status of ['pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment', 'payment_authorized'] as const) {
      expect(canCancelCustomer(asDetail(makeBooking({ status })))).toBe(true)
    }
  })

  it('blocks cancellation for in_progress and completed', () => {
    expect(canCancelCustomer(asDetail(makeBooking({ status: 'in_progress' })))).toBe(false)
    expect(canCancelCustomer(asDetail(makeCompletedBooking()))).toBe(false)
  })
})

describe('cannotAttend()', () => {
  it('returns true for cleaner-cancellable statuses when not started', () => {
    for (const status of ['pending_request', 'accepted', 'paid'] as const) {
      expect(cannotAttend(asDetail(makeBooking({ status })))).toBe(true)
    }
  })

  it('returns false once booking has started', () => {
    const b = asDetail(makePaidBooking({ started_at: '2026-01-15T09:01:00.000Z' }))
    expect(cannotAttend(b)).toBe(false)
  })

  it('returns false for non-eligible statuses', () => {
    expect(cannotAttend(asDetail(makeCompletedBooking()))).toBe(false)
  })
})

describe('isTransitionAllowed()', () => {
  it('allows valid customer transitions', () => {
    expect(isTransitionAllowed('pending_request', 'cancelled', 'customer')).toBe(true)
    expect(isTransitionAllowed('accepted', 'cancelled', 'customer')).toBe(true)
    expect(isTransitionAllowed('completed', 'disputed', 'customer')).toBe(true)
  })

  it('allows valid cleaner transitions', () => {
    expect(isTransitionAllowed('pending_request', 'accepted', 'cleaner')).toBe(true)
    expect(isTransitionAllowed('in_progress', 'completed', 'cleaner')).toBe(true)
  })

  it('blocks cleaner from actions reserved for customer', () => {
    expect(isTransitionAllowed('pending_request', 'cancelled', 'cleaner')).toBe(false)
    expect(isTransitionAllowed('accepted', 'cancelled', 'cleaner')).toBe(false)
  })

  it('allows admin all transitions that others can do', () => {
    expect(isTransitionAllowed('pending_request', 'accepted', 'admin')).toBe(true)
    expect(isTransitionAllowed('disputed', 'refunded', 'admin')).toBe(true)
  })

  it('blocks impossible transitions regardless of actor', () => {
    expect(isTransitionAllowed('pending_request', 'completed', 'admin')).toBe(false)
    expect(isTransitionAllowed('completed', 'in_progress', 'admin')).toBe(false)
  })
})
