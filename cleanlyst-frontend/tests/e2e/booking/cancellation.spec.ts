import { test, expect } from '@playwright/test'
import {
  TEST_ENV,
  getUserIdByEmail,
  findLatestBookingForCustomer,
  updateBooking,
  cleanupBookingsForCustomer,
  getLatestBookingStatus,
  serviceClient,
} from '../utils'
import { loginAs, logout } from '../helpers/login'

function futureDate(daysAhead = 3) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return date.toISOString().slice(0, 10)
}

async function createBookingViaUI(page: import('@playwright/test').Page) {
  await page.goto('/book')
  await expect(page.locator('text=Book Cleaner')).toBeVisible()
  await page.getByRole('button', { name: /standard cleaning/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()
  await page.getByLabel('Date').fill(futureDate(3))
  await page.getByLabel('Start Time').fill('11:00')
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
}

test.describe('Booking cancellation flows', () => {
  let customerUserId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(TEST_ENV.E2E_CUSTOMER_EMAIL)
  })

  test.afterEach(async () => {
    await cleanupBookingsForCustomer(customerUserId)
  })

  test('customer can cancel a pending_request booking', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await createBookingViaUI(page)

    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()

    await page.goto(`/customer/bookings/${booking!.id}`)
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()

    await expect(page.locator('text=Cancelled')).toBeVisible({ timeout: 10_000 })

    const status = await getLatestBookingStatus(booking!.id as string)
    expect(status).toBe('cancelled')
  })

  test('customer can cancel an accepted booking', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await createBookingViaUI(page)

    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()

    await updateBooking(booking!.id as string, {
      status: 'accepted',
      payment_status: 'captured',
      scheduled_start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
    })

    await page.goto(`/customer/bookings/${booking!.id}`)
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()

    await expect(page.locator('text=Cancelled')).toBeVisible({ timeout: 10_000 })

    const status = await getLatestBookingStatus(booking!.id as string)
    expect(status).toBe('cancelled')
  })

  test('cleaner cannot attend — marks booking as cleaner_cancelled', async ({ page }) => {
    // Create booking and accept it
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await createBookingViaUI(page)
    await logout(page)

    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()

    await updateBooking(booking!.id as string, {
      status: 'paid',
      payment_status: 'captured',
      scheduled_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    })

    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto(`/cleaner/bookings/${booking!.id}`)

    await expect(page.getByRole('button', { name: /cannot attend/i })).toBeVisible()
    await page.getByRole('button', { name: /cannot attend/i }).click()

    await page.getByRole('button', { name: /confirm/i }).click()

    await expect(page.locator('text=Cleaner Unavailable').or(page.locator('text=Cancelled'))).toBeVisible({
      timeout: 10_000,
    })

    const status = await getLatestBookingStatus(booking!.id as string)
    expect(status).toBe('cleaner_cancelled')
  })

  test('completed booking cannot be cancelled by customer', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await createBookingViaUI(page)

    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()

    await updateBooking(booking!.id as string, {
      status: 'completed',
      payment_status: 'captured',
    })

    await page.goto(`/customer/bookings/${booking!.id}`)
    await expect(page.getByRole('button', { name: /cancel/i })).not.toBeVisible()
  })
})
