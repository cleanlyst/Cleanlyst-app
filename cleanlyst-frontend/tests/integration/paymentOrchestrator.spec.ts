/**
 * Integration tests for paymentOrchestrator.
 * Mocks Edge Function callers and event emission.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { refundPayment, releasePayout } from '@/services/payments/paymentOrchestrator'

// ─── Mock the Edge Function wrappers ─────────────────────────────────────────

const mockCallRefundPaymentEF = vi.fn()
const mockProcessPayout       = vi.fn()

vi.mock('@/services/paymentService', () => ({
  refundPayment:  (...args: unknown[]) => mockCallRefundPaymentEF(...args),
  processPayout:  (...args: unknown[]) => mockProcessPayout(...args),
  startCheckoutSession:   vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test', provider: 'stripe_checkout', simulationMode: false }),
  startAdditionalPayment: vi.fn().mockResolvedValue({ provider: 'stripe_checkout', simulationMode: false }),
}))

vi.mock('@/services/payments/paymentEvents', () => ({
  makePaymentStartedEvent:   vi.fn(() => ({ type: 'payment.started' })),
  makePaymentRefundedEvent:  vi.fn(() => ({ type: 'payment.refunded' })),
}))

describe('paymentOrchestrator.refundPayment()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to the refund-payment Edge Function', async () => {
    mockCallRefundPaymentEF.mockResolvedValue({ success: true, refund_id: 're_test_001' })
    const result = await refundPayment('booking-1')
    expect(mockCallRefundPaymentEF).toHaveBeenCalledWith('booking-1', undefined, undefined)
    expect(result.success).toBe(true)
  })

  it('passes amountCents and reason through to Edge Function', async () => {
    mockCallRefundPaymentEF.mockResolvedValue({ success: true, refund_id: 're_test_002' })
    await refundPayment('booking-2', { amountCents: 5_000, reason: 'partial_service' })
    expect(mockCallRefundPaymentEF).toHaveBeenCalledWith('booking-2', 5_000, 'partial_service')
  })

  it('returns stripe_checkout provider and simulationMode: false', async () => {
    mockCallRefundPaymentEF.mockResolvedValue({ success: true })
    const result = await refundPayment('booking-3')
    expect(result.provider).toBe('stripe_checkout')
    expect(result.simulationMode).toBe(false)
  })

  it('propagates Edge Function errors', async () => {
    mockCallRefundPaymentEF.mockRejectedValue(new Error('Stripe refund failed'))
    await expect(refundPayment('booking-4')).rejects.toThrow('Stripe refund failed')
  })
})

describe('paymentOrchestrator.releasePayout()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to processPayout', async () => {
    mockProcessPayout.mockResolvedValue({ success: true, transfer_id: 'tr_test_001' })
    const result = await releasePayout('booking-5')
    expect(mockProcessPayout).toHaveBeenCalledWith('booking-5')
    expect(result.success).toBe(true)
  })

  it('propagates processPayout errors', async () => {
    mockProcessPayout.mockRejectedValue(new Error('Transfer failed'))
    await expect(releasePayout('booking-6')).rejects.toThrow('Transfer failed')
  })
})
