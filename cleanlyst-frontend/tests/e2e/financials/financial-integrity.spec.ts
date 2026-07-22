import { test, expect } from '@playwright/test'
import {
  TEST_ENV,
  getUserIdByEmail,
  findLatestBookingForCustomer,
  updateBooking,
  cleanupBookingsForCustomer,
  findBookingFinancials,
  findAllCompletedBookingsWithFinancials,
} from '../utils'
import { loginAs } from '../helpers/login'

function futureDate(daysAhead = 3) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return date.toISOString().slice(0, 10)
}

test.describe('Financial integrity invariants', () => {
  let customerUserId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(TEST_ENV.E2E_CUSTOMER_EMAIL)
  })

  test.afterEach(async () => {
    await cleanupBookingsForCustomer(customerUserId)
  })

  test('booking_financials satisfies all three invariants after booking flow', async ({ page }) => {
    // Create booking and complete full lifecycle via DB shortcuts
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/book')
    await expect(page.locator('text=Book Cleaner')).toBeVisible()
    await page.getByRole('button', { name: /standard cleaning/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByLabel('Date').fill(futureDate(3))
    await page.getByLabel('Start Time').fill('10:00')
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByLabel('Property Type').selectOption('terraced_house')
    await page.getByLabel('Bedrooms').selectOption('2')
    await page.getByLabel('Bathrooms').selectOption('1')
    await page.getByPlaceholder('Address line 1').fill('12 Wigan Lane')
    await page.getByPlaceholder('Postcode').fill('WN1 1AA')
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page.locator('text=Available Cleaners')).toBeVisible()
    await page.getByRole('button', { name: /^book$/i }).first().click()
    await page.getByRole('button', { name: /confirm and pay/i }).click()
    await expect(page.locator('text=Payment Successful')).toBeVisible()
    await page.getByRole('button', { name: /continue/i }).click()

    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()
    const bookingId = booking!.id as string

    // Force to completed with financials populated
    await updateBooking(bookingId, {
      status: 'completed',
      payment_status: 'captured',
      scheduled_start: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    })

    const fin = await findBookingFinancials(bookingId)
    expect(fin).not.toBeNull()
    if (!fin) return

    // Invariant 1: customer_total = service_price + booking_fee
    if (fin.service_price_cents > 0) {
      expect(fin.quote_cents).toBe(fin.service_price_cents + fin.booking_fee_cents)
    } else {
      // Legacy financials without breakdown — just check quote is positive
      expect(fin.quote_cents).toBeGreaterThan(0)
    }

    // Invariant 2: service_price = commission + cleaner_payout
    if (fin.service_price_cents > 0) {
      expect(fin.service_price_cents).toBe(fin.cleaner_commission_cents + fin.cleaner_payout_cents)
    }

    // Invariant 3: platform_revenue = booking_fee + commission
    if (fin.platform_revenue_cents > 0) {
      expect(fin.platform_revenue_cents).toBe(fin.booking_fee_cents + fin.cleaner_commission_cents)
    }

    // Basic sanity: all values non-negative
    expect(fin.quote_cents).toBeGreaterThan(0)
    expect(fin.cleaner_payout_cents).toBeGreaterThanOrEqual(0)
    expect(fin.booking_fee_cents).toBeGreaterThanOrEqual(0)
    expect(fin.platform_fee_cents).toBeGreaterThanOrEqual(0)
  })

  test('all existing completed bookings satisfy financial invariants', async () => {
    const records = await findAllCompletedBookingsWithFinancials()

    for (const fin of records) {
      if (fin.service_price_cents > 0) {
        expect(fin.quote_cents).toBe(
          fin.service_price_cents + fin.booking_fee_cents,
          `Invariant 1 failed for booking ${fin.booking_id}: quote(${fin.quote_cents}) ≠ service(${fin.service_price_cents}) + fee(${fin.booking_fee_cents})`,
        )

        expect(fin.service_price_cents).toBe(
          fin.cleaner_commission_cents + fin.cleaner_payout_cents,
          `Invariant 2 failed for booking ${fin.booking_id}: service(${fin.service_price_cents}) ≠ commission(${fin.cleaner_commission_cents}) + payout(${fin.cleaner_payout_cents})`,
        )
      }

      if (fin.platform_revenue_cents > 0) {
        expect(fin.platform_revenue_cents).toBe(
          fin.booking_fee_cents + fin.cleaner_commission_cents,
          `Invariant 3 failed for booking ${fin.booking_id}: platform_revenue(${fin.platform_revenue_cents}) ≠ fee(${fin.booking_fee_cents}) + commission(${fin.cleaner_commission_cents})`,
        )
      }

      expect(fin.quote_cents).toBeGreaterThan(0)
      expect(fin.cleaner_payout_cents).toBeGreaterThanOrEqual(0)
    }
  })

  test('cleaner payout is less than customer total (platform takes a cut)', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/book')
    await expect(page.locator('text=Book Cleaner')).toBeVisible()
    await page.getByRole('button', { name: /standard cleaning/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByLabel('Date').fill(futureDate(4))
    await page.getByLabel('Start Time').fill('10:00')
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByLabel('Property Type').selectOption('terraced_house')
    await page.getByLabel('Bedrooms').selectOption('2')
    await page.getByLabel('Bathrooms').selectOption('1')
    await page.getByPlaceholder('Address line 1').fill('12 Wigan Lane')
    await page.getByPlaceholder('Postcode').fill('WN1 1AA')
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page.locator('text=Available Cleaners')).toBeVisible()
    await page.getByRole('button', { name: /^book$/i }).first().click()
    await page.getByRole('button', { name: /confirm and pay/i }).click()
    await expect(page.locator('text=Payment Successful')).toBeVisible()

    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()

    const fin = await findBookingFinancials(booking!.id as string)
    expect(fin).not.toBeNull()
    if (!fin) return

    expect(fin.cleaner_payout_cents).toBeLessThan(fin.quote_cents)
  })
})
