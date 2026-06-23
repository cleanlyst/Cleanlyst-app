import { describe, expect, it } from 'vitest'
import { calculatePricing } from '@/services/pricingEngine'

const DEFAULT_SETTINGS = { bookingFeePercent: 7, cleanerCommissionPercent: 15 }

describe('calculatePricing()', () => {
  it('computes correct values for a £100 service (10000p) with default settings', () => {
    const result = calculatePricing(10_000, DEFAULT_SETTINGS)

    expect(result.servicePriceCents).toBe(10_000)
    expect(result.bookingFeeCents).toBe(700)           // 7% of 10000
    expect(result.totalCustomerCents).toBe(10_700)     // 10000 + 700
    expect(result.cleanerCommissionCents).toBe(1_500)  // 15% of 10000
    expect(result.cleanerPayoutCents).toBe(8_500)      // 10000 - 1500
    expect(result.platformRevenueCents).toBe(2_200)    // 700 + 1500
  })

  it('cleanerPayoutCents + platformRevenueCents = totalCustomerCents', () => {
    for (const price of [5_000, 10_000, 25_000, 50_000]) {
      const r = calculatePricing(price, DEFAULT_SETTINGS)
      expect(r.cleanerPayoutCents + r.platformRevenueCents).toBe(r.totalCustomerCents)
    }
  })

  it('reflects custom fee percentages', () => {
    const r = calculatePricing(10_000, { bookingFeePercent: 10, cleanerCommissionPercent: 20 })
    expect(r.bookingFeeCents).toBe(1_000)
    expect(r.cleanerCommissionCents).toBe(2_000)
    expect(r.totalCustomerCents).toBe(11_000)
    expect(r.cleanerPayoutCents).toBe(8_000)
  })

  it('rounds to whole pence using Math.round', () => {
    // 7% of £73 = £5.11 — rounded
    const r = calculatePricing(7_300, DEFAULT_SETTINGS)
    expect(Number.isInteger(r.bookingFeeCents)).toBe(true)
    expect(Number.isInteger(r.cleanerCommissionCents)).toBe(true)
    expect(Number.isInteger(r.totalCustomerCents)).toBe(true)
    expect(Number.isInteger(r.cleanerPayoutCents)).toBe(true)
  })

  it('returns zero fees for a zero-price service', () => {
    const r = calculatePricing(0, DEFAULT_SETTINGS)
    expect(r.bookingFeeCents).toBe(0)
    expect(r.totalCustomerCents).toBe(0)
    expect(r.cleanerPayoutCents).toBe(0)
    expect(r.platformRevenueCents).toBe(0)
  })

  it('passes through fee percentages on the result object', () => {
    const settings = { bookingFeePercent: 8, cleanerCommissionPercent: 12 }
    const r = calculatePricing(10_000, settings)
    expect(r.bookingFeePercent).toBe(8)
    expect(r.cleanerCommissionPercent).toBe(12)
  })
})
