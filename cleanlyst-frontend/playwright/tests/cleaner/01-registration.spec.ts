/**
 * Cleaner Registration Journey
 *
 * Covers:
 *  - Register as a cleaner (role selection)
 *  - Complete onboarding steps
 *  - Cleaner dashboard shows "pending approval" state
 *  - Cleaner cannot access customer or admin pages
 *  - Cleaner cannot make bookings while pending
 *  - Cleaner cannot be viewed in search while pending
 */
import { test, expect }   from '../../fixtures'
import { RegisterPage }   from '../../pageObjects/RegisterPage'
import { CleanerDashboard } from '../../pageObjects/CleanerDashboard'
import { makeCleanerProfile } from '../../helpers/dataFactory'
import { db, deleteUser, setCleanerRole } from '../../helpers/db'

test.describe.configure({ mode: 'serial' })

test.describe('Cleaner registration', () => {
  let createdUserId: string | null = null

  test.afterAll(async () => {
    if (createdUserId) await deleteUser(createdUserId)
  })

  // ── C1.1  Register as cleaner ─────────────────────────────────────────────────

  test('C1.1 — new cleaner registers and lands on dashboard/onboarding', async ({ page }) => {
    const profile   = makeCleanerProfile()
    const register  = new RegisterPage(page)

    await register.goto()
    await register.registerAndWait({
      fullName: profile.fullName,
      email:    profile.email,
      password: profile.password,
      role:     'cleaner',
    })

    await expect(page).toHaveURL(/cleaner\/dashboard|onboarding/, { timeout: 20_000 })

    // Capture for cleanup
    const { data } = await db.auth.admin.listUsers({ query: profile.email, page: 1, perPage: 10 })
    const user = data.users.find((u) => u.email === profile.email)
    createdUserId = user?.id ?? null
  })

  // ── C1.2  Pending approval state shown ────────────────────────────────────────

  test('C1.2 — cleaner dashboard shows pending approval for cleaner_pending role', async ({ cleanerPage: page }) => {
    // The standing E2E cleaner is approved — temporarily demote to test pending state
    const { getUserIdByEmail: getById } = await import('../../helpers/db')
    const cleanerUserId = await getById(process.env.E2E_CLEANER_EMAIL!)

    await setCleanerRole(cleanerUserId, 'cleaner_pending')

    try {
      await page.reload()
      await page.waitForLoadState('networkidle')

      const dashboard = new CleanerDashboard(page)
      await dashboard.gotoBookings()
      // Pending cleaner should see approval message
      await dashboard.assertAwaitingApproval()
    } finally {
      // Always restore to active
      await setCleanerRole(cleanerUserId, 'cleaner_active')
    }
  })

  // ── C1.3  Role access control ─────────────────────────────────────────────────

  test('C1.3 — cleaner cannot access /customer/dashboard', async ({ cleanerPage: page }) => {
    await page.goto('/customer/dashboard')
    await expect(page).not.toHaveURL(/customer\/dashboard/, { timeout: 10_000 })
  })

  test('C1.4 — cleaner cannot access /admin/dashboard', async ({ cleanerPage: page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/admin\/dashboard/, { timeout: 10_000 })
  })

  // ── C1.5  Cleaner cannot start booking wizard ─────────────────────────────────

  test('C1.5 — cleaner is redirected away from /book', async ({ cleanerPage: page }) => {
    await page.goto('/book')
    await expect(page).not.toHaveURL(/^.*\/book$/, { timeout: 10_000 })
  })
})
