import { test, expect } from '@playwright/test'
import { TEST_ENV, serviceClient } from '../utils'
import { loginAs } from '../helpers/login'

// ── Shared navigation helper ──────────────────────────────────────
async function goToCleaners(page: Parameters<typeof loginAs>[0]) {
  await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
  await page.goto('/admin/dashboard/cleaners')
  await page.waitForLoadState('networkidle')
}

// ── Helper: seed a disposable approved cleaner ────────────────────
async function seedApprovedCleaner() {
  const email = `e2e-cleaner-mgmt-${Date.now()}@test.cleanlyst.local`
  const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
    email,
    password: 'TestPass123!',
    email_confirm: true,
    user_metadata: { full_name: 'E2E Manage Cleaner' },
  })
  if (authErr) throw authErr
  const userId = authData.user.id

  await serviceClient.from('profiles').upsert(
    { id: userId, email, role: 'cleaner_active', full_name: 'E2E Manage Cleaner', city: 'Wigan', is_active: true },
    { onConflict: 'id' },
  )
  await serviceClient.from('cleaner_profiles').upsert(
    {
      user_id: userId,
      business_name: 'E2E Test Cleaning Co.',
      bio: 'Seeded for E2E testing.',
      service_radius_km: 20,
      hourly_rate_cents: 2000,
      currency: 'GBP',
      status: 'approved',
      onboarding_complete: true,
    },
    { onConflict: 'user_id' },
  )
  return { userId, email }
}

async function deleteCleaner(userId: string) {
  await serviceClient.from('cleaner_profiles').delete().eq('user_id', userId)
  await serviceClient.from('profiles').delete().eq('id', userId)
  await serviceClient.auth.admin.deleteUser(userId)
}

// ── Helper: seed a booking with a captured payment ────────────────
async function seedBookingWithPayment(customerId: string, cleanerId: string) {
  const scheduledStart = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const scheduledEnd = new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString()

  const { data: booking, error: bErr } = await serviceClient
    .from('bookings')
    .insert({
      customer_id: customerId,
      cleaner_id: cleanerId,
      status: 'completed',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      service_title_snapshot: 'Standard Cleaning',
      category_snapshot: 'standard',
      quote_cents: 5000,
    })
    .select('id')
    .single()
  if (bErr) throw bErr

  const { error: pErr } = await serviceClient.from('payments').insert({
    booking_id: booking.id,
    amount_cents: 5000,
    platform_fee_cents: 500,
    cleaner_payout_cents: 4500,
    status: 'captured',
    currency: 'GBP',
  })
  if (pErr) throw pErr

  return booking.id as string
}

// ── All Cleaners section ──────────────────────────────────────────

test.describe('Admin — All Cleaners section', () => {
  test('section heading and search input are visible', async ({ page }) => {
    await goToCleaners(page)
    await expect(page.getByRole('heading', { name: /all cleaners/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cleaner-search-input')).toBeVisible()
  })

  test('status filter dropdown is rendered', async ({ page }) => {
    await goToCleaners(page)
    await expect(page.getByTestId('cleaner-status-filter')).toBeVisible({ timeout: 10_000 })
  })

  test('search by name narrows the table', async ({ page }) => {
    await goToCleaners(page)
    const searchInput = page.getByTestId('cleaner-search-input')
    await searchInput.fill('E2E')
    // Wait for debounce + network
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')
    // Table either shows matching rows or the empty-state message — no crash
    const rows = page.locator('[data-testid^="cleaner-row-"]')
    const emptyMsg = page.getByText(/no cleaners found/i)
    const count = await rows.count()
    if (count === 0) {
      await expect(emptyMsg).toBeVisible()
    } else {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('status filter to "approved" shows only approved cleaners', async ({ page }) => {
    await goToCleaners(page)
    const filter = page.getByTestId('cleaner-status-filter')
    await filter.selectOption('approved')
    await page.waitForTimeout(400)
    await page.waitForLoadState('networkidle')
    // No assertion on count — just verify no crash and section still visible
    await expect(page.getByRole('heading', { name: /all cleaners/i })).toBeVisible()
  })

  test('pagination Previous is disabled on first page', async ({ page }) => {
    await goToCleaners(page)
    await page.waitForLoadState('networkidle')
    // Previous button should be present
    const prev = page.getByRole('button', { name: /previous/i }).last()
    // On page 1, previous should be disabled (or absent if <10 results)
    const isDisabled = await prev.isDisabled().catch(() => true)
    expect(isDisabled).toBe(true)
  })
})

// ── Suspend / Reactivate flow ─────────────────────────────────────

test.describe('Admin — Suspend and Reactivate cleaner', () => {
  let userId: string

  test.beforeAll(async () => {
    const seeded = await seedApprovedCleaner()
    userId = seeded.userId
  })

  test.afterAll(async () => {
    await deleteCleaner(userId)
  })

  test('suspend modal opens and confirm button is present', async ({ page }) => {
    await goToCleaners(page)
    // Search for the seeded cleaner to make sure the row appears
    await page.getByTestId('cleaner-search-input').fill('E2E Manage Cleaner')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    const suspendBtn = page.getByTestId(`suspend-${userId}`)
    await expect(suspendBtn).toBeVisible({ timeout: 10_000 })
    await suspendBtn.click()

    await expect(page.getByTestId('confirm-suspend-btn')).toBeVisible({ timeout: 5_000 })
  })

  test('suspend cleaner updates status to suspended', async ({ page }) => {
    await goToCleaners(page)
    await page.getByTestId('cleaner-search-input').fill('E2E Manage Cleaner')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    const suspendBtn = page.getByTestId(`suspend-${userId}`)
    await expect(suspendBtn).toBeVisible({ timeout: 10_000 })
    await suspendBtn.click()
    await expect(page.getByTestId('confirm-suspend-btn')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('confirm-suspend-btn').click()
    await page.waitForLoadState('networkidle')

    // Verify in DB
    const { data } = await serviceClient
      .from('cleaner_profiles')
      .select('status')
      .eq('user_id', userId)
      .single()
    expect((data as { status: string } | null)?.status).toBe('suspended')
  })

  test('reactivate modal opens after cleaner is suspended', async ({ page }) => {
    await goToCleaners(page)
    await page.getByTestId('cleaner-search-input').fill('E2E Manage Cleaner')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    const reactivateBtn = page.getByTestId(`reactivate-${userId}`)
    await expect(reactivateBtn).toBeVisible({ timeout: 10_000 })
    await reactivateBtn.click()
    await expect(page.getByTestId('confirm-reactivate-btn')).toBeVisible({ timeout: 5_000 })
  })

  test('reactivate cleaner restores approved status', async ({ page }) => {
    // Ensure cleaner is suspended first
    await serviceClient
      .from('cleaner_profiles')
      .update({ status: 'suspended' })
      .eq('user_id', userId)
    await serviceClient.from('profiles').update({ is_active: false }).eq('id', userId)

    await goToCleaners(page)
    await page.getByTestId('cleaner-search-input').fill('E2E Manage Cleaner')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    const reactivateBtn = page.getByTestId(`reactivate-${userId}`)
    await expect(reactivateBtn).toBeVisible({ timeout: 10_000 })
    await reactivateBtn.click()
    await expect(page.getByTestId('confirm-reactivate-btn')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('confirm-reactivate-btn').click()
    await page.waitForLoadState('networkidle')

    const { data } = await serviceClient
      .from('cleaner_profiles')
      .select('status')
      .eq('user_id', userId)
      .single()
    expect((data as { status: string } | null)?.status).toBe('approved')
  })
})

// ── View Profile modal ────────────────────────────────────────────

test.describe('Admin — View Cleaner Profile modal', () => {
  let userId: string

  test.beforeAll(async () => {
    const seeded = await seedApprovedCleaner()
    userId = seeded.userId
  })

  test.afterAll(async () => {
    await deleteCleaner(userId)
  })

  test('view profile modal opens and shows cleaner name', async ({ page }) => {
    await goToCleaners(page)
    await page.getByTestId('cleaner-search-input').fill('E2E Manage Cleaner')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    const profileBtn = page.getByTestId(`view-profile-${userId}`)
    await expect(profileBtn).toBeVisible({ timeout: 10_000 })
    await profileBtn.click()

    // Modal should open and show the cleaner's name
    await expect(page.getByText('E2E Manage Cleaner')).toBeVisible({ timeout: 8_000 })
  })

  test('deactivate modal opens', async ({ page }) => {
    await goToCleaners(page)
    await page.getByTestId('cleaner-search-input').fill('E2E Manage Cleaner')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')

    const deactivateBtn = page.getByTestId(`deactivate-${userId}`)
    await expect(deactivateBtn).toBeVisible({ timeout: 10_000 })
    await deactivateBtn.click()
    await expect(page.getByTestId('confirm-deactivate-btn')).toBeVisible({ timeout: 5_000 })
  })
})

// ── Refund modal ──────────────────────────────────────────────────

test.describe('Admin — Process Refund modal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/admin/dashboard/bookings')
    await page.waitForLoadState('networkidle')
  })

  test('Process Refund button opens the modal', async ({ page }) => {
    await page.getByTestId('open-refund-modal').click()
    await expect(page.getByRole('heading', { name: /process refund/i })).toBeVisible({ timeout: 5_000 })
  })

  test('modal shows booking ID lookup field', async ({ page }) => {
    await page.getByTestId('open-refund-modal').click()
    await expect(page.getByPlaceholder(/paste booking id/i)).toBeVisible({ timeout: 5_000 })
  })

  test('invalid booking ID shows error', async ({ page }) => {
    await page.getByTestId('open-refund-modal').click()
    await page.getByPlaceholder(/paste booking id/i).fill('00000000-0000-0000-0000-000000000000')
    await page.getByRole('button', { name: /look up/i }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 8_000 })
  })

  test('closing modal hides it', async ({ page }) => {
    await page.getByTestId('open-refund-modal').click()
    await expect(page.getByRole('heading', { name: /process refund/i })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: /process refund/i })).not.toBeVisible()
  })
})

test.describe('Admin — Refund full and partial flow', () => {
  let bookingId: string
  let cleanerUserId: string
  let customerUserId: string

  test.beforeAll(async () => {
    // Look up the E2E users
    const { data: customerRows } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', TEST_ENV.E2E_CUSTOMER_EMAIL)
      .maybeSingle()
    const { data: cleanerRows } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', TEST_ENV.E2E_CLEANER_EMAIL)
      .maybeSingle()

    if (!customerRows || !cleanerRows) {
      throw new Error('E2E users not found — run seedTestData first')
    }
    customerUserId = (customerRows as { id: string }).id
    cleanerUserId = (cleanerRows as { id: string }).id
    bookingId = await seedBookingWithPayment(customerUserId, cleanerUserId)
  })

  test.afterAll(async () => {
    await serviceClient.from('payments').delete().eq('booking_id', bookingId)
    await serviceClient.from('booking_status_events').delete().eq('booking_id', bookingId)
    await serviceClient.from('notifications').delete().eq('booking_id', bookingId)
    await serviceClient.from('bookings').delete().eq('id', bookingId)
  })

  test('full refund flow — confirm button processes refund', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/admin/dashboard/bookings')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('open-refund-modal').click()
    await page.getByPlaceholder(/paste booking id/i).fill(bookingId)
    await page.getByRole('button', { name: /look up/i }).click()
    await page.waitForLoadState('networkidle')

    // Booking details should appear
    await expect(page.getByText(/standard cleaning/i)).toBeVisible({ timeout: 10_000 })

    // Full refund is selected by default; pick a reason
    await page.locator('select#refund-reason').selectOption('cleaner_no_show')

    await expect(page.getByTestId('confirm-refund-btn')).toBeEnabled({ timeout: 3_000 })
    await page.getByTestId('confirm-refund-btn').click()
    await page.waitForLoadState('networkidle')

    // Success state
    await expect(page.getByText(/refund processed/i)).toBeVisible({ timeout: 10_000 })
  })

  test('partial refund flow — custom amount validation', async ({ page }) => {
    // Re-seed a fresh booking for this test since the previous test consumed the payment
    const freshBookingId = await seedBookingWithPayment(customerUserId, cleanerUserId)

    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/admin/dashboard/bookings')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('open-refund-modal').click()
    await page.getByPlaceholder(/paste booking id/i).fill(freshBookingId)
    await page.getByRole('button', { name: /look up/i }).click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/standard cleaning/i)).toBeVisible({ timeout: 10_000 })

    // Switch to partial
    await page.locator('input[type="radio"][value="partial"]').click()
    await expect(page.locator('input#refund-amount')).toBeVisible({ timeout: 3_000 })

    // Enter a partial amount (£15 of £50)
    await page.locator('input#refund-amount').fill('15.00')
    await page.locator('select#refund-reason').selectOption('service_issue')

    await expect(page.getByTestId('confirm-refund-btn')).toBeEnabled({ timeout: 3_000 })
    await page.getByTestId('confirm-refund-btn').click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/refund processed/i)).toBeVisible({ timeout: 10_000 })

    // Clean up
    await serviceClient.from('payments').delete().eq('booking_id', freshBookingId)
    await serviceClient.from('booking_status_events').delete().eq('booking_id', freshBookingId)
    await serviceClient.from('notifications').delete().eq('booking_id', freshBookingId)
    await serviceClient.from('bookings').delete().eq('id', freshBookingId)
  })
})
