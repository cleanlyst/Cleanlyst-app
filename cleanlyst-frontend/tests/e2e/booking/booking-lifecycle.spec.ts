import { test, expect } from '@playwright/test'
import {
  TEST_ENV,
  getUserIdByEmail,
  findLatestBookingForCustomer,
  updateBooking,
  cleanupBookingsForCustomer,
  getLatestBookingStatus,
} from '../utils'
import { loginAs, logout } from '../helpers/login'

function futureDate(daysAhead = 3) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return date.toISOString().slice(0, 10)
}

test.describe('Booking lifecycle — customer books, cleaner accepts and completes', () => {
  let customerUserId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(TEST_ENV.E2E_CUSTOMER_EMAIL)
  })

  test.afterEach(async () => {
    await cleanupBookingsForCustomer(customerUserId)
  })

  test('full booking lifecycle: create → accept → start → complete', async ({ page }) => {
    // ── Step 1: Customer creates booking ─────────────────────────────────────
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await expect(page).toHaveURL(/customer\/dashboard/)

    await page.goto('/book')
    await expect(page.locator('text=Book Cleaner')).toBeVisible()

    await page.getByRole('button', { name: /standard cleaning/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    await page.getByLabel('Date').fill(futureDate(3))
    await page.getByLabel('Start Time').fill('10:00')
    await page.getByRole('button', { name: /continue/i }).click()

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
    await expect(page).toHaveURL(/customer\/dashboard/)

    // ── Step 2: Verify booking exists in DB ───────────────────────────────────
    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()

    // ── Step 3: Cleaner accepts booking ───────────────────────────────────────
    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await expect(page).toHaveURL(/cleaner\/dashboard/)

    await page.goto('/cleaner/dashboard/bookings')
    await expect(page.locator('text=Pending')).toBeVisible()
    await page.getByRole('button', { name: /accept/i }).first().click()
    await expect(page.locator('text=Accepted')).toBeVisible({ timeout: 10_000 })

    // ── Step 4: Patch DB to bypass 60-min start window ────────────────────────
    await updateBooking(booking!.id as string, {
      status: 'paid',
      payment_status: 'captured',
      scheduled_start: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 100 * 60 * 1000).toISOString(),
    })

    // ── Step 5: Cleaner starts and completes cleaning ─────────────────────────
    await page.reload()
    await page.getByRole('button', { name: /start cleaning/i }).click()
    await expect(page.locator('text=In progress')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /complete cleaning/i }).click()
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10_000 })

    // ── Step 6: Verify final status in DB ────────────────────────────────────
    const finalStatus = await getLatestBookingStatus(booking!.id as string)
    expect(finalStatus).toBe('completed')
  })

  test('customer sees booking on dashboard after creation', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/book')
    await expect(page.locator('text=Book Cleaner')).toBeVisible()

    await page.getByRole('button', { name: /standard cleaning/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    await page.getByLabel('Date').fill(futureDate(4))
    await page.getByLabel('Start Time').fill('14:00')
    await page.getByRole('button', { name: /continue/i }).click()

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

    await expect(page).toHaveURL(/customer\/dashboard/)
    await expect(page.locator('text=Pending')).toBeVisible()
  })

  test('cleaner sees pending request and can decline', async ({ page }) => {
    // Create booking via DB seed
    const booking = await findLatestBookingForCustomer(customerUserId)
    if (!booking?.id) {
      // Create one via UI first
      await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
      await page.goto('/book')
      await page.getByRole('button', { name: /standard cleaning/i }).click()
      await page.getByRole('button', { name: /continue/i }).click()
      await page.getByLabel('Date').fill(futureDate(5))
      await page.getByLabel('Start Time').fill('09:00')
      await page.getByRole('button', { name: /continue/i }).click()
      await page.getByLabel('Bedrooms').selectOption('2')
      await page.getByLabel('Bathrooms').selectOption('1')
      await page.getByPlaceholder('Address line 1').fill('12 Wigan Lane')
      await page.getByPlaceholder('Postcode').fill('WN1 1AA')
      await page.getByRole('button', { name: /continue/i }).click()
      await expect(page.locator('text=Available Cleaners')).toBeVisible()
      await page.getByRole('button', { name: /^book$/i }).first().click()
      await page.getByRole('button', { name: /confirm and pay/i }).click()
      await expect(page.locator('text=Payment Successful')).toBeVisible()
      await logout(page)
    } else {
      await page.evaluate(() => localStorage.clear())
    }

    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/bookings')
    await expect(page.locator('text=Pending')).toBeVisible()
    await page.getByRole('button', { name: /decline/i }).first().click()
    await expect(page.locator('text=Declined')).toBeVisible({ timeout: 10_000 })
  })
})
