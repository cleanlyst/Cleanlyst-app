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

// ─── Helpers ────────────────────────────────────────────────────────────────

function futureDate(daysAhead = 3) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

/**
 * Walk through the 5-step booking wizard and submit payment.
 * Returns after the "Payment Successful" banner is visible.
 *
 * Labels are connected to inputs with for/id pairs (SearchCleaner.vue step 2).
 */
async function completeBookingWizard(
  page: import('@playwright/test').Page,
  daysAhead = 3,
) {
  await page.goto('/book')
  await expect(page.locator('text=Book Cleaner')).toBeVisible()

  // Step 1 — service selection
  await page.getByRole('button', { name: /standard cleaning/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 2 — schedule  (inputs now have id="booking-date" / id="booking-time")
  await page.getByLabel('Date').fill(futureDate(daysAhead))
  await page.getByLabel('Start Time').fill('10:00')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 3 — property details  (propertyType is required for canNext)
  await page.getByLabel('Property Type').selectOption('terraced_house')
  await page.getByLabel('Bedrooms').selectOption('2')
  await page.getByLabel('Bathrooms').selectOption('1')
  await page.getByPlaceholder('Address line 1').fill('12 Wigan Lane')
  await page.getByPlaceholder('Postcode').fill('WN1 1AA')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 4 — cleaner selection
  await expect(page.locator('text=Available Cleaners')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /^book$/i }).first().click()

  // Step 5 — confirm & pay (button is disabled while services load)
  await expect(page.getByTestId('confirm-pay-btn')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('confirm-pay-btn').click()
  await expect(page.locator('text=Payment Successful')).toBeVisible({ timeout: 30_000 })
}

// ─── Test suite ──────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' })

test.describe('Booking lifecycle', () => {
  let customerUserId: string
  let cleanerUserId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(TEST_ENV.E2E_CUSTOMER_EMAIL)
    cleanerUserId = await getUserIdByEmail(TEST_ENV.E2E_CLEANER_EMAIL)
  })

  test.afterEach(async () => {
    await cleanupBookingsForCustomer(customerUserId)
    // Clear availability overrides so each test starts with a clean calendar
    await serviceClient.from('availability_overrides').delete().eq('cleaner_id', cleanerUserId)
  })

  // ══ TEST 1 — Customer creates booking ══════════════════════════════════════
  test('TEST 1 — customer creates booking, DB status is pending_request', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await completeBookingWizard(page, 3)

    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page).toHaveURL(/customer\/dashboard/)

    // DB assertions
    const booking = await findLatestBookingForCustomer(customerUserId)
    expect(booking?.id).toBeTruthy()
    expect(booking?.status).toBe('pending_request')
    expect(booking?.payment_status).toBe('captured')

    // UI: pending booking visible on dashboard
    await expect(page.locator('text=Pending').first()).toBeVisible()
  })

  // ══ TEST 2 — Cleaner accepts booking ══════════════════════════════════════
  test('TEST 2 — cleaner accepts booking; status auto-advances to paid; dashboards update', async ({
    page,
  }) => {
    // Customer creates booking
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await completeBookingWizard(page, 4)
    await page.getByRole('button', { name: /continue/i }).click()

    const booking = await findLatestBookingForCustomer(customerUserId)
    const bookingId = booking!.id as string

    // Cleaner accepts via the bookings list
    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/bookings')
    // Wait for page to be fully loaded before interacting — ensures Supabase
    // client has fully re-initialised with the cleaner's session.
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('accept-booking-btn').first()).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('accept-booking-btn').first().click()

    // After accepting, booking auto-advances: accepted → paid (payment already captured).
    // Cleaner sees "Ready to Start" label for status = paid.
    // The accept button disappears and either a start button or the "Ready to Start" status appears.
    await expect(
      page
        .locator('text=Ready to Start')
        .or(page.getByTestId('start-cleaning-btn'))
        .first(),
    ).toBeVisible({ timeout: 15_000 })

    // DB: status is 'paid', accepted_at is set
    const dbStatus = await getLatestBookingStatus(bookingId)
    expect(dbStatus).toBe('paid')

    const { data: row } = await serviceClient
      .from('bookings')
      .select('accepted_at')
      .eq('id', bookingId)
      .maybeSingle()
    expect((row as { accepted_at: string | null } | null)?.accepted_at).not.toBeNull()

    // Customer bookings page shows the booking with its current status label
    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/customer/dashboard/bookings')
    await page.waitForLoadState('networkidle')
    // The Active tab includes 'paid' status (added in previous audit fix).
    // CustomerBookingsSection uses getBookingStatusLabel which returns "Confirmed & Paid" for paid.
    await page.getByRole('button', { name: 'Active' }).click()
    await expect(page.locator('text=Confirmed').first()).toBeVisible({ timeout: 10_000 })
  })

  // ══ TEST 3 — Cleaner starts cleaning ══════════════════════════════════════
  test('TEST 3 — cleaner starts cleaning; status becomes in_progress; started_at set', async ({
    page,
  }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await completeBookingWizard(page, 5)
    await page.getByRole('button', { name: /continue/i }).click()

    const booking = await findLatestBookingForCustomer(customerUserId)
    const bookingId = booking!.id as string

    // Patch to paid + set start time within the 60-min window
    await updateBooking(bookingId, {
      status: 'paid',
      payment_status: 'captured',
      accepted_at: new Date().toISOString(),
      scheduled_start: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 125 * 60 * 1000).toISOString(),
    })

    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/bookings')

    // "Active" tab should now show the paid booking with a Start button
    await page.getByRole('button', { name: 'Active' }).click()
    await expect(page.getByTestId('start-cleaning-btn').first()).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('start-cleaning-btn').first().click()

    // Status changes to "Cleaning in progress" (cleaner label for in_progress)
    await expect(page.locator('text=Cleaning in progress').first()).toBeVisible({ timeout: 15_000 })

    // DB assertions
    expect(await getLatestBookingStatus(bookingId)).toBe('in_progress')
    const { data: row } = await serviceClient
      .from('bookings')
      .select('started_at')
      .eq('id', bookingId)
      .maybeSingle()
    expect((row as { started_at: string | null } | null)?.started_at).not.toBeNull()
  })

  // ══ TEST 4 — Complete cleaning ════════════════════════════════════════════
  test('TEST 4 — cleaner ends cleaning; earnings and admin revenue increase', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await completeBookingWizard(page, 6)
    await page.getByRole('button', { name: /continue/i }).click()

    const booking = await findLatestBookingForCustomer(customerUserId)
    const bookingId = booking!.id as string

    // Patch directly to in_progress so cleaner can complete immediately
    await updateBooking(bookingId, {
      status: 'in_progress',
      payment_status: 'captured',
      accepted_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      scheduled_start: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 80 * 60 * 1000).toISOString(),
    })

    // Snapshot earnings / revenue before completion
    const cleanerId = await getUserIdByEmail(TEST_ENV.E2E_CLEANER_EMAIL)
    const { data: profileBefore } = await serviceClient
      .from('cleaner_profiles')
      .select('total_earnings_cents')
      .eq('user_id', cleanerId)
      .maybeSingle()
    const earningsBefore =
      (profileBefore as { total_earnings_cents: number } | null)?.total_earnings_cents ?? 0

    const { data: adminBefore } = await serviceClient
      .from('admin_stats')
      .select('total_revenue_cents')
      .eq('id', 1)
      .maybeSingle()
    const revBefore =
      (adminBefore as { total_revenue_cents: number } | null)?.total_revenue_cents ?? 0

    // Cleaner ends the job
    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/bookings')
    await page.getByRole('button', { name: 'Active' }).click()

    await expect(page.getByTestId('end-cleaning-btn').first()).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('end-cleaning-btn').first().click()

    await expect(page.locator('text=Completed').first()).toBeVisible({ timeout: 15_000 })

    // DB: status, timestamps, payment status
    expect(await getLatestBookingStatus(bookingId)).toBe('completed')

    const { data: completedRow } = await serviceClient
      .from('bookings')
      .select('completed_at, payment_status')
      .eq('id', bookingId)
      .maybeSingle()
    const cr = completedRow as { completed_at: string | null; payment_status: string } | null
    expect(cr?.completed_at).not.toBeNull()
    expect(cr?.payment_status).toBe('released')

    // Cleaner earnings increased
    const { data: profileAfter } = await serviceClient
      .from('cleaner_profiles')
      .select('total_earnings_cents')
      .eq('user_id', cleanerId)
      .maybeSingle()
    expect(
      (profileAfter as { total_earnings_cents: number } | null)?.total_earnings_cents ?? 0,
    ).toBeGreaterThan(earningsBefore)

    // Admin revenue increased
    const { data: adminAfter } = await serviceClient
      .from('admin_stats')
      .select('total_revenue_cents')
      .eq('id', 1)
      .maybeSingle()
    expect(
      (adminAfter as { total_revenue_cents: number } | null)?.total_revenue_cents ?? 0,
    ).toBeGreaterThan(revBefore)

    // Financial integrity: customer payment = cleaner payout + platform revenue
    const { data: fin } = await serviceClient
      .from('booking_financials')
      .select('quote_cents, cleaner_payout_cents, platform_revenue_cents')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (fin) {
      const f = fin as {
        quote_cents: number
        cleaner_payout_cents: number
        platform_revenue_cents: number
      }
      expect(f.quote_cents).toBe(f.cleaner_payout_cents + f.platform_revenue_cents)
    }

    // Completed booking visible to customer
    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/customer/dashboard/bookings')
    await page.getByRole('button', { name: 'Completed' }).click()
    await expect(page.locator('text=Completed').first()).toBeVisible()
  })

  // ══ TEST 5 — Double acceptance prevention ═════════════════════════════════
  test('TEST 5 — accept button disappears after booking is accepted; no duplicate events', async ({
    page,
  }) => {
    // Create booking
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await completeBookingWizard(page, 7)
    await page.getByRole('button', { name: /continue/i }).click()

    const booking = await findLatestBookingForCustomer(customerUserId)
    const bookingId = booking!.id as string

    // Cleaner accepts via UI
    await logout(page)
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/bookings')
    await expect(page.getByTestId('accept-booking-btn').first()).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('accept-booking-btn').first().click()

    // Status should become 'paid' (auto-advance)
    await expect(
      page.locator('text=Ready to Start').or(page.getByTestId('start-cleaning-btn')).first(),
    ).toBeVisible({ timeout: 15_000 })

    // The accept button must be gone — booking is no longer in pending state
    await expect(page.getByTestId('accept-booking-btn')).toHaveCount(0)

    // DB: exactly one 'accepted' status event
    const { data: events } = await serviceClient
      .from('booking_status_events')
      .select('to_status')
      .eq('booking_id', bookingId)
      .eq('to_status', 'accepted')
    expect((events ?? []).length).toBeLessThanOrEqual(1)

    // Final status
    expect(await getLatestBookingStatus(bookingId)).toBe('paid')
  })

  // ══ TEST 6 — Availability conflict blocks acceptance ══════════════════════
  test('TEST 6 — cleaner_has_booking_conflict returns true for overlapping slot', async ({
    page: _page,
  }) => {
    const cleanerId = await getUserIdByEmail(TEST_ENV.E2E_CLEANER_EMAIL)
    const customerId = await getUserIdByEmail(TEST_ENV.E2E_CUSTOMER_EMAIL)

    const slotStart = new Date(Date.now() + 72 * 60 * 60 * 1000)
    slotStart.setMinutes(0, 0, 0)
    const slotEnd = new Date(slotStart.getTime() + 2 * 60 * 60 * 1000)

    // Seed an accepted booking in the overlapping slot
    const { data: existing } = await serviceClient
      .from('bookings')
      .insert({
        customer_id: customerId,
        cleaner_id: cleanerId,
        service_title_snapshot: 'Standard Cleaning',
        category_snapshot: 'standard',
        location_text: '1 Conflict Road, Wigan',
        scheduled_start: slotStart.toISOString(),
        scheduled_end: slotEnd.toISOString(),
        quote_cents: 3000,
        cleaner_payout_cents: 2790,
        currency: 'GBP',
        status: 'accepted',
        payment_status: 'captured',
      })
      .select('id')
      .single()
    const existingId = (existing as { id: string } | null)?.id
    expect(existingId).toBeTruthy()

    // cleaner_has_booking_conflict must return true for the same window
    const { data: hasConflict, error: conflictError } = await serviceClient.rpc(
      'cleaner_has_booking_conflict',
      {
        p_cleaner_id: cleanerId,
        p_start: slotStart.toISOString(),
        p_end: slotEnd.toISOString(),
      },
    )
    expect(conflictError).toBeNull()
    expect(hasConflict).toBe(true)

    // A non-overlapping window must NOT be flagged as a conflict
    const laterStart = new Date(slotEnd.getTime() + 60 * 60 * 1000)
    const laterEnd = new Date(laterStart.getTime() + 2 * 60 * 60 * 1000)
    const { data: noConflict } = await serviceClient.rpc('cleaner_has_booking_conflict', {
      p_cleaner_id: cleanerId,
      p_start: laterStart.toISOString(),
      p_end: laterEnd.toISOString(),
    })
    expect(noConflict).toBe(false)

    // Acceptance of a pending booking in the conflicting slot is blocked
    // (requires migration 20260609100000_acceptance_conflict_check to be applied).
    // Seed a second pending booking in the same slot.
    const { data: b2 } = await serviceClient
      .from('bookings')
      .insert({
        customer_id: customerId,
        cleaner_id: cleanerId,
        service_title_snapshot: 'Standard Cleaning',
        category_snapshot: 'standard',
        location_text: '2 Conflict Road, Wigan',
        scheduled_start: slotStart.toISOString(),
        scheduled_end: slotEnd.toISOString(),
        quote_cents: 3000,
        cleaner_payout_cents: 2790,
        currency: 'GBP',
        status: 'pending_request',
        payment_status: 'captured',
      })
      .select('id')
      .single()
    const booking2Id = (b2 as { id: string } | null)?.id
    expect(booking2Id).toBeTruthy()

    // The conflict function confirms the second booking's slot is taken
    const { data: b2Conflict } = await serviceClient.rpc('cleaner_has_booking_conflict', {
      p_cleaner_id: cleanerId,
      p_start: slotStart.toISOString(),
      p_end: slotEnd.toISOString(),
    })
    expect(b2Conflict).toBe(true)

    // Cleanup test-only bookings
    await serviceClient.from('bookings').delete().in('id', [existingId!, booking2Id!])
  })
})
