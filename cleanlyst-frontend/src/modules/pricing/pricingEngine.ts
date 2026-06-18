/**
 * Unified pricing module — single source of truth for all financial calculations.
 *
 * All booking money flows (customer total, cleaner payout, platform revenue,
 * booking fee, commission) must be derived from calculateBookingPricing().
 * Never duplicate these calculations elsewhere.
 *
 * Re-exports fetchPlatformSettings and invalidatePlatformSettingsCache from
 * the existing service so callers only need to import from this module.
 */

export type {
  PlatformFeeSettings,
  PricingResult,
} from '@/services/pricingEngine'

export {
  fetchPlatformSettings,
  invalidatePlatformSettingsCache,
  calculatePricing,
  getPricing,
} from '@/services/pricingEngine'

import { calculatePricing } from '@/services/pricingEngine'
import type { PlatformFeeSettings } from '@/services/pricingEngine'

/** Canonical breakdown interface used across admin, cleaner, and customer views. */
export interface PricingBreakdown {
  serviceAmountCents: number
  bookingFeeCents: number
  commissionFeeCents: number
  customerTotalCents: number
  cleanerPayoutCents: number
  platformRevenueCents: number
  bookingFeePercent: number
  cleanerCommissionPercent: number
}

/**
 * Calculate a complete pricing breakdown from the service amount and platform settings.
 *
 * @param serviceAmountCents  Base service price in pence (no fees applied yet)
 * @param settings            Fee percentages from platform_settings
 */
export function calculateBookingPricing(
  serviceAmountCents: number,
  settings: PlatformFeeSettings,
): PricingBreakdown {
  const result = calculatePricing(serviceAmountCents, settings)

  return {
    serviceAmountCents: result.servicePriceCents,
    bookingFeeCents: result.bookingFeeCents,
    commissionFeeCents: result.cleanerCommissionCents,
    customerTotalCents: result.totalCustomerCents,
    cleanerPayoutCents: result.cleanerPayoutCents,
    platformRevenueCents: result.platformRevenueCents,
    bookingFeePercent: result.bookingFeePercent,
    cleanerCommissionPercent: result.cleanerCommissionPercent,
  }
}
