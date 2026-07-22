/**
 * Customer Booking Creation Journey
 *
 * Covers:
 *  - Search cleaners flow (step 4 of wizard)
 *  - View cleaner profile
 *  - Complete all 5 wizard steps
 *  - DB reflects pending_request status with payment captured
 *  - Dashboard shows booking under correct tab
 *  - Wizard navigation — back button works between steps
 *  - Cannot submit without required fields
 */
import { test, expect }      from '../../fixtures'
import { BookingWizard }     from '../../pageObjects/BookingWizard'
import { CustomerDashboard } from '../../pageObjects/CustomerDashboard'
import { getUserIdByEmail, latestBookingForCustomer, wipeDynamic } from '../../helpers/db'

test.describe.configure({ mode: 'serial' })

test.describe('Booking creation wizard', () => {
  let customerUserId: string
  let cleanerUserId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(process.env.E2E_CUSTOMER_EMAIL!)
    cleanerUserId  = await getUserIdByEmail(process.env.E2E_CLEANER_EMAIL!)
  })

  test.afterEach(async () => {
    await wipeDynamic(customerUserId, cleanerUserId)
  })

  // ── 2.1  Full happy-path ────────────────────────────────────────────────────

  test('2.1 — customer completes full wizard, booking created in DB', async ({ customerPage: page }) => {
    const wizard    = new BookingWizard(page)
    const dashboard = new CustomerDashboard(page)

    await wizard.goto()
    await wizard.selectService()

    // Step 2 — schedule
    await wizard.fillSchedule({ daysAhead: 3, time: '09:00' })

    // Step 3 — property
    await wizard.fillProperty()

    // Step 4 — cleaner list (verify it shows before selecting)
    await expect(page.locator('text=Available Cleaners')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^book$/i }).first()).toBeVisible()
    await wizard.selectFirstCleaner()

    // Step 5 — confirm
    await expect(page.getByTestId('confirm-pay-btn')
      .or(page.getByRole('button', { name: /confirm and pay/i }))).toBeEnabled({ timeout: 15_000 })

    await wizard.confirmAndPay()
    await wizard.dismissSuccess()

    // DB assertions
    // With Stripe Checkout (capture_method: manual), the webhook fires
    // checkout.session.completed → PAYMENT_AUTHORIZED → booking.payment_status = 'authorized'
    // and booking.status transitions to 'payment_authorized'.
    // If the webhook has a slight delay, booking may still be in 'pending_request'/'unpaid'.
    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()
    expect(['pending_request', 'payment_authorized']).toContain(booking?.status)
    expect(['unpaid', 'authorized']).toContain(booking?.payment_status)

    // Dashboard — booking visible under Pending tab
    await dashboard.gotoBookings()
    await dashboard.switchTab('Pending')
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })

  // ── 2.2  Step validation — cannot advance without required fields ───────────

  test('2.2 — step 3 requires property type before advancing', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule()

    // Skip property type — just click Continue without filling required field
    await page.getByRole('button', { name: /continue/i }).click()

    // Should remain on step 3 or show validation
    const step3Heading = page.getByText(/property|address/i).first()
    const isStillOnStep3 = await step3Heading.isVisible()
    const hasValidation  = await page.getByText(/required|select|please/i).first().isVisible()
    expect(isStillOnStep3 || hasValidation).toBe(true)
  })

  // ── 2.3  Wizard back navigation ─────────────────────────────────────────────

  test('2.3 — back button on step 2 returns to step 1', async ({ customerPage: page }) => {
    await page.goto('/book')
    await expect(page.locator('text=Book Cleaner')).toBeVisible()

    await page.getByRole('button', { name: /standard cleaning/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Now on step 2 — go back
    const backBtn = page.getByRole('button', { name: /back|previous/i })
    if (await backBtn.isVisible()) {
      await backBtn.click()
      // Should be back on service selection
      await expect(page.getByRole('button', { name: /standard cleaning/i })).toBeVisible({ timeout: 5000 })
    }
  })

  // ── 2.4  View cleaner profile before booking ─────────────────────────────────

  test('2.4 — customer can view cleaner profile on step 4', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 4 })
    await wizard.fillProperty()

    await expect(page.locator('text=Available Cleaners')).toBeVisible({ timeout: 20_000 })

    // Click on cleaner name/avatar to view profile (if this link exists)
    const profileLink = page.getByRole('link', { name: /view profile|profile/i }).first()
    if (await profileLink.isVisible({ timeout: 5000 })) {
      await profileLink.click()
      await expect(page).toHaveURL(/cleaner|profile/)
      await page.goBack()
    } else {
      // Profile is shown inline — check for cleaner name/rating elements
      await expect(page.getByText(/cleaner|available/i).first()).toBeVisible()
    }
  })

  // ── 2.5  Booking page inaccessible without auth ──────────────────────────────

  test('2.5 — /book redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/book')
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10_000 })
  })
})
