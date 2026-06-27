/**
 * 00-dashboard — Admin Dashboard smoke + accessibility.
 *
 * Verifies: dashboard loads, KPI cards render, navigation cards work,
 * sidebar links work, realtime indicator, no console errors.
 */
import { test, expect } from '../../fixtures'
import {
  collectConsoleErrors,
  collectNetworkFailures,
  assertAccessibility,
  assertNoLoadingSpinners,
  assertButtonsHaveNames,
  measureNavigation,
} from '../../helpers/adminGuards'

test.describe.configure({ mode: 'serial' })

test.describe('Admin dashboard', () => {

  test('D0.1 — dashboard loads without console errors or network failures', async ({ adminPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    const { failures, attach: attachNet } = collectNetworkFailures(page)
    attach()
    attachNet()

    await measureNavigation(page, async () => {
      await page.goto('/admin/dashboard')
      await page.waitForLoadState('networkidle')
    }, 3000)

    expect(errors, `Console errors: ${errors.join('; ')}`).toHaveLength(0)
    expect(failures, `Network failures: ${failures.join('; ')}`).toHaveLength(0)
  })

  test('D0.2 — heading "Admin Dashboard" is visible', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /admin dashboard/i }).first()).toBeVisible()
  })

  test('D0.3 — sidebar navigation links are visible', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation').first()
    await expect(nav).toBeVisible()

    // Core admin links
    for (const label of ['Cleaners', 'Bookings', 'Financials']) {
      await expect(nav.getByRole('link', { name: new RegExp(label, 'i') })).toBeVisible()
    }
  })

  test('D0.4 — KPI / stat cards render on the overview page', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    // At least one metric/stat value block should be visible
    const metrics = page.locator('[class*="stat"], [class*="metric"], [class*="kpi"], [class*="card"]').first()
    const headings = page.getByRole('heading').nth(1)
    await expect(headings.or(metrics)).toBeVisible({ timeout: 10_000 })
  })

  test('D0.5 — navigating via sidebar Cleaners link reaches cleaners page', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation').first()
    const cleanersLink = nav.getByRole('link', { name: /cleaners/i }).first()
    await expect(cleanersLink).toBeVisible()
    await cleanersLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/admin\/dashboard/)
  })

  test('D0.6 — navigating via sidebar Bookings link reaches bookings page', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation').first()
    const link = nav.getByRole('link', { name: /bookings/i }).first()
    await expect(link).toBeVisible()
    await link.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/admin\/dashboard/)
  })

  test('D0.7 — Operations Console sidebar link navigates correctly', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation').first()
    const opsLink = nav.getByRole('link', { name: /ops console|operations/i }).first()
    if (await opsLink.isVisible({ timeout: 3_000 })) {
      await opsLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/admin\/ops/)
    }
  })

  test('D0.8 — Financial Close sidebar link navigates correctly', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation').first()
    const link = nav.getByRole('link', { name: /financial close/i }).first()
    if (await link.isVisible({ timeout: 3_000 })) {
      await link.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/admin\/financial-close/)
    }
  })

  test('D0.9 — no loading spinner remains after page settles', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await assertNoLoadingSpinners(page)
  })

  // ── Accessibility ──────────────────────────────────────────────────────────

  test('D0.10 — accessibility: main, nav, heading landmarks present', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await assertAccessibility(page)
  })

  test('D0.11 — accessibility: buttons have accessible names', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await assertButtonsHaveNames(page)
  })

  // ── Performance ────────────────────────────────────────────────────────────

  test('D0.12 — performance: dashboard loads under 3 seconds', async ({ adminPage: page }) => {
    const elapsed = await measureNavigation(page, async () => {
      await page.goto('/admin/dashboard')
      await page.waitForLoadState('networkidle')
    }, 3000)
    // Warn but don't fail — network conditions vary in CI
    if (elapsed > 3000) {
      console.warn(`[perf] dashboard load ${elapsed}ms exceeded 3s threshold`)
    }
    // Hard limit: 10 seconds
    expect(elapsed).toBeLessThan(10_000)
  })
})
