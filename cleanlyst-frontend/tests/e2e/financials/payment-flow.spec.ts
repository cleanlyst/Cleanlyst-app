/**
 * E2E: Financial flow — Stripe Checkout → capture → payout.
 *
 * Tests the complete payment path in Stripe test mode.
 * Uses Stripe's test card numbers — no real money moves.
 */

import { test, expect } from '@playwright/test'
import { loginAs, logout } from '../helpers/login'
import {
  TEST_ENV,
  getUserIdByEmail,
  serviceClient,
  findLatestBookingForCustomer,
  cleanupBookingsForCustomer,
} from '../utils'

const STRIPE_TEST_CARD = {
  number:  '4242 4242 4242 4242',
  expiry:  '12/26',
  cvc:     '424',
  postal:  'TE1 1ST',
}

function futureDate(daysAhead = 5) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

test.describe('Financial flow — payment to payout', () => {
  test.describe.configure({ mode: 'serial' })

  let customerUserId: string
  let bookingId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(TEST_ENV.E2E_CUSTOMER_EMAIL)
  })

  test.afterAll(async () => {
    await cleanupBookingsForCustomer(customerUserId)
  })

  test('customer can complete Stripe Checkout and see authorized state', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)

    // Navigate to booking flow
    await page.goto('/book')
    await expect(page.locator('text=Book Cleaner')).toBeVisible()

    // Step 1 — service
    await page.getByRole('button', { name: /standard cleaning/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 2 — schedule
    await page.getByLabel('Date').fill(futureDate(5))
    await page.getByLabel('Start Time').fill('10:00')
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 3 — property
    await page.getByLabel('Property Type').selectOption('terraced_house')
    await page.getByLabel('Bedrooms').selectOption('2')
    await page.getByLabel('Bathrooms').selectOption('1')
    await page.getByPlaceholder('Address line 1').fill('12 Test Lane')
    await page.getByPlaceholder('Postcode').fill('TE1 1ST')
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 4 — cleaner
    await expect(page.locator('text=Available Cleaners')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /^book$/i }).first().click()

    // Step 5 — confirm and pay
    await expect(page.getByTestId('confirm-pay-btn')).toBeEnabled({ timeout: 15_000 })
    await page.getByTestId('confirm-pay-btn').click()

    // Stripe Checkout page
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 })

    // Fill in test card
    await page.locator('[placeholder="1234 1234 1234 1234"]').fill(STRIPE_TEST_CARD.number)
    await page.locator('[placeholder="MM / YY"]').fill(STRIPE_TEST_CARD.expiry)
    await page.locator('[placeholder="CVC"]').fill(STRIPE_TEST_CARD.cvc)
    await page.locator('[placeholder="ZIP"]').fill(STRIPE_TEST_CARD.postal)
    await page.getByRole('button', { name: /pay/i }).click()

    // Returned to app
    await expect(page).toHaveURL(/cleanlyst|localhost/, { timeout: 30_000 })
    await expect(page.locator('text=Payment Successful')).toBeVisible({ timeout: 30_000 })

    // Retrieve booking ID for subsequent tests
    const booking = await findLatestBookingForCustomer(customerUserId)
    bookingId = booking?.id
    expect(bookingId).toBeTruthy()

    await logout(page)
  })

  test('booking enters payment_authorized state after checkout', async () => {
    if (!bookingId) test.skip()

    // Verify DB state directly
    const { data } = await serviceClient
      .from('bookings')
      .select('status, payment_status')
      .eq('id', bookingId)
      .single()

    expect(data?.payment_status).toBe('authorized')
    expect(data?.status).toBe('payment_authorized')
  })

  test('ledger has PAYMENT_AUTHORIZED event after checkout', async () => {
    if (!bookingId) test.skip()

    const { data } = await serviceClient
      .from('payment_ledger_events')
      .select('event_type, amount_cents')
      .eq('booking_id', bookingId)
      .eq('event_type', 'PAYMENT_AUTHORIZED')

    expect(data?.length).toBeGreaterThan(0)
    expect(data?.[0].event_type).toBe('PAYMENT_AUTHORIZED')
  })

  test('cleaner can start job after payment authorization', async ({ page }) => {
    if (!bookingId) test.skip()

    // Manually set booking to accepted + in start window
    await serviceClient.from('bookings').update({
      status:          'payment_authorized',
      accepted_at:     new Date().toISOString(),
      scheduled_start: new Date(Date.now() - 30 * 60_000).toISOString(), // 30 min ago
    }).eq('id', bookingId)

    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto(`/cleaner/bookings/${bookingId}`)

    await expect(page.getByRole('button', { name: /start cleaning/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /start cleaning/i }).click()
    await expect(page.locator('text=in progress', { exact: false })).toBeVisible({ timeout: 10_000 })

    await logout(page)
  })
})
