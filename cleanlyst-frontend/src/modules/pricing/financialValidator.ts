/**
 * Validates that a financial record's derived values are internally consistent.
 * Call whenever booking_financials are written or displayed.
 *
 * Rules (all values in pence):
 *   customer_total   = service_fee + booking_fee
 *   platform_revenue = booking_fee + commission
 *   cleaner_payout   = service_fee - commission
 */

export interface FinancialRecord {
  serviceAmountCents: number
  bookingFeeCents: number
  commissionCents: number
  customerTotalCents: number
  cleanerPayoutCents: number
  platformRevenueCents: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFinancials(record: FinancialRecord): ValidationResult {
  const errors: string[] = []

  if (record.customerTotalCents !== record.serviceAmountCents + record.bookingFeeCents) {
    errors.push(
      `customer_total (${record.customerTotalCents}p) ≠ service_fee (${record.serviceAmountCents}p) + booking_fee (${record.bookingFeeCents}p)`,
    )
  }

  if (record.platformRevenueCents !== record.bookingFeeCents + record.commissionCents) {
    errors.push(
      `platform_revenue (${record.platformRevenueCents}p) ≠ booking_fee (${record.bookingFeeCents}p) + commission (${record.commissionCents}p)`,
    )
  }

  if (record.cleanerPayoutCents !== record.serviceAmountCents - record.commissionCents) {
    errors.push(
      `cleaner_payout (${record.cleanerPayoutCents}p) ≠ service_fee (${record.serviceAmountCents}p) - commission (${record.commissionCents}p)`,
    )
  }

  if (errors.length > 0) {
    console.error('[FinancialValidator] Validation failed:', errors, record)
  }

  return { valid: errors.length === 0, errors }
}
