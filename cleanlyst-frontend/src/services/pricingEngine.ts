import { getSupabaseClient } from '@/services/supabaseClient'

export interface PlatformFeeSettings {
  bookingFeePercent: number
  cleanerCommissionPercent: number
}

export interface PricingResult {
  servicePriceCents: number
  bookingFeeCents: number
  totalCustomerCents: number
  cleanerCommissionCents: number
  cleanerPayoutCents: number
  platformRevenueCents: number
  bookingFeePercent: number
  cleanerCommissionPercent: number
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cachedSettings: PlatformFeeSettings | null = null
let cacheExpiry = 0

export async function fetchPlatformSettings(): Promise<PlatformFeeSettings> {
  const now = Date.now()
  if (cachedSettings && now < cacheExpiry) {
    return cachedSettings
  }

  const supabase = getSupabaseClient()
  // Use select('*') — if cleaner_commission_percent column doesn't exist yet
  // (migration pending) PostgREST would error on an explicit column list.
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .limit(1)
    .single()

  if (error || !data) {
    // Fall back to safe defaults if settings table is unreachable or RLS blocks
    const defaults: PlatformFeeSettings = { bookingFeePercent: 7, cleanerCommissionPercent: 15 }
    cachedSettings = defaults
    cacheExpiry = now + CACHE_TTL_MS
    return defaults
  }

  const row = data as Record<string, unknown>
  const settings: PlatformFeeSettings = {
    bookingFeePercent: Number(row.booking_fee_percent ?? 7),
    cleanerCommissionPercent: Number(row.cleaner_commission_percent ?? 15),
  }

  cachedSettings = settings
  cacheExpiry = now + CACHE_TTL_MS
  return settings
}

/** Invalidate the in-memory cache — call after an admin saves new settings */
export function invalidatePlatformSettingsCache(): void {
  cachedSettings = null
  cacheExpiry = 0
}

/**
 * Pure calculation — no I/O. Use when you already have settings in hand.
 */
export function calculatePricing(
  servicePriceCents: number,
  settings: PlatformFeeSettings,
): PricingResult {
  const bookingFeeCents = Math.round(servicePriceCents * (settings.bookingFeePercent / 100))
  const cleanerCommissionCents = Math.round(
    servicePriceCents * (settings.cleanerCommissionPercent / 100),
  )
  const totalCustomerCents = servicePriceCents + bookingFeeCents
  const cleanerPayoutCents = servicePriceCents - cleanerCommissionCents
  const platformRevenueCents = bookingFeeCents + cleanerCommissionCents

  return {
    servicePriceCents,
    bookingFeeCents,
    totalCustomerCents,
    cleanerCommissionCents,
    cleanerPayoutCents,
    platformRevenueCents,
    bookingFeePercent: settings.bookingFeePercent,
    cleanerCommissionPercent: settings.cleanerCommissionPercent,
  }
}

/**
 * Fetches live platform settings (TTL-cached) then computes pricing.
 * This is the primary call site for all UI pricing calculations.
 */
export async function getPricing(servicePriceCents: number): Promise<PricingResult> {
  const settings = await fetchPlatformSettings()
  return calculatePricing(servicePriceCents, settings)
}
