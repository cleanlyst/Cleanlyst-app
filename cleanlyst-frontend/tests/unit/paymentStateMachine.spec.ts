import { describe, expect, it } from 'vitest'
import {
  handle,
  derivePaymentReadiness,
  paymentStatusLabel,
} from '@/services/payments/paymentStateMachine'

describe('paymentStateMachine.handle()', () => {
  describe('PaymentStarted', () => {
    it('is always a noop regardless of booking status', () => {
      const statuses = ['pending_request', 'accepted', 'paid', 'payment_authorized'] as const
      for (const status of statuses) {
        const out = handle({ eventType: 'PaymentStarted', currentBookingStatus: status })
        expect(out.action).toBe('noop')
        expect(out.targetBookingStatus).toBeNull()
        expect(out.targetPaymentStatus).toBeNull()
      }
    })
  })

  describe('PaymentAuthorized', () => {
    it('always transitions to payment_authorized with authorized payment status', () => {
      const out = handle({ eventType: 'PaymentAuthorized', currentBookingStatus: 'accepted' })
      expect(out.action).toBe('transition')
      expect(out.targetBookingStatus).toBe('payment_authorized')
      expect(out.targetPaymentStatus).toBe('authorized')
    })
  })

  describe('PaymentCaptured', () => {
    it('transitions booking to paid when currently in payment_authorized', () => {
      const out = handle({ eventType: 'PaymentCaptured', currentBookingStatus: 'payment_authorized' })
      expect(out.action).toBe('transition')
      expect(out.targetBookingStatus).toBe('paid')
      expect(out.targetPaymentStatus).toBe('captured')
    })

    it('is noop for booking status when booking has already advanced past payment_authorized', () => {
      for (const status of ['paid', 'in_progress', 'completed'] as const) {
        const out = handle({ eventType: 'PaymentCaptured', currentBookingStatus: status })
        expect(out.action).toBe('noop')
        expect(out.targetBookingStatus).toBeNull()
        expect(out.targetPaymentStatus).toBe('captured')
      }
    })
  })

  describe('PaymentRefunded', () => {
    it('transitions pre-service bookings to cancelled', () => {
      for (const status of ['accepted', 'paid', 'payment_authorized', 'pending_request'] as const) {
        const out = handle({ eventType: 'PaymentRefunded', currentBookingStatus: status })
        expect(out.targetBookingStatus).toBe('cancelled')
        expect(out.targetPaymentStatus).toBe('refunded')
        expect(out.action).toBe('transition')
      }
    })

    it('transitions post-service bookings to refunded', () => {
      for (const status of ['in_progress', 'completed', 'disputed', 'completion_pending_customer'] as const) {
        const out = handle({ eventType: 'PaymentRefunded', currentBookingStatus: status })
        expect(out.targetBookingStatus).toBe('refunded')
        expect(out.targetPaymentStatus).toBe('refunded')
      }
    })
  })

  describe('PayoutReleased', () => {
    it('is always a noop — payout state lives in payouts table', () => {
      const out = handle({ eventType: 'PayoutReleased', currentBookingStatus: 'completed' })
      expect(out.action).toBe('noop')
      expect(out.targetBookingStatus).toBeNull()
      expect(out.targetPaymentStatus).toBeNull()
    })
  })
})

describe('derivePaymentReadiness()', () => {
  it('returns true only for captured', () => {
    expect(derivePaymentReadiness('captured')).toBe(true)
  })

  it.each(['unpaid', 'authorized', 'refunded', null, undefined, ''])(
    'returns false for %s',
    (status) => {
      expect(derivePaymentReadiness(status)).toBe(false)
    },
  )
})

describe('paymentStatusLabel()', () => {
  it('returns correct label for each status', () => {
    expect(paymentStatusLabel('unpaid')).toBe('Unpaid')
    expect(paymentStatusLabel('authorized')).toBe('Payment held')
    expect(paymentStatusLabel('captured')).toBe('Payment received')
    expect(paymentStatusLabel('refunded')).toBe('Refunded')
  })

  it('returns Unknown for unrecognised values', () => {
    expect(paymentStatusLabel(null)).toBe('Unknown')
    expect(paymentStatusLabel(undefined)).toBe('Unknown')
    expect(paymentStatusLabel('anything')).toBe('Unknown')
  })
})
