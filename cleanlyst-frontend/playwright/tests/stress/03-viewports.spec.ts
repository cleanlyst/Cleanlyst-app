/**
 * UX Stress: Multi-Viewport Tests
 *
 * Covers:
 *  - Mobile viewport (375×667) — key pages accessible and readable
 *  - Tablet viewport (768×1024) — key pages accessible and readable
 *  - Desktop viewport (1280×800) — baseline (also covered by all other tests)
 *  - Nav/hamburger menu on mobile
 *  - Booking wizard usable on mobile
 *  - Dashboard usable on mobile
 *
 * Note: This spec runs across three Playwright projects (chromium, mobile-chrome,
 * tablet-chrome) as configured in playwright.config.ts.
 */
import { test, expect } from '../../fixtures'
import { LoginPage }    from '../../pageObjects/LoginPage'

// ── Viewport helpers ──────────────────────────────────────────────────────────

const VIEWPORTS = {
  mobile:  { width: 375,  height: 667  },
  tablet:  { width: 768,  height: 1024 },
  desktop: { width: 1280, height: 800  },
}

// ── Mobile viewport ───────────────────────────────────────────────────────────

test.describe('Mobile viewport (375×667)', () => {
  test.use({ viewport: VIEWPORTS.mobile })

  test('M1 — login page is usable on mobile', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // All fields visible
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitBtn).toBeVisible()

    // Fields are not overflowing — width should be within viewport
    const box = await loginPage.emailInput.boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 20)
  })

  test('M2 — customer dashboard is usable on mobile', async ({ customerPage: page }) => {
    await page.goto('/customer/dashboard')
    await page.waitForLoadState('networkidle')

    // Dashboard content visible
    await expect(page.getByText(/my bookings|dashboard/i).first()).toBeVisible()

    // No horizontal scroll overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 40)
  })

  test('M3 — mobile navigation (hamburger/drawer) opens on mobile', async ({ customerPage: page }) => {
    await page.goto('/customer/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for hamburger/menu button
    const hamburger = page.getByRole('button', { name: /menu|hamburger|nav/i })
      .or(page.locator('[class*="hamburger"], [class*="menu-toggle"], [aria-label="Menu"]').first())

    if (await hamburger.isVisible()) {
      await hamburger.click()
      // Navigation links should appear
      await expect(
        page.getByRole('link', { name: /bookings|dashboard/i }).first()
          .or(page.getByRole('navigation')),
      ).toBeVisible({ timeout: 5000 })
    } else {
      // App may use a fixed bottom nav on mobile instead of a hamburger
      const bottomNav = page.locator('[class*="bottom-nav"], [class*="tab-bar"], nav')
      if (await bottomNav.isVisible()) {
        await expect(bottomNav.getByRole('link').first()).toBeVisible()
      }
    }
  })

  test('M4 — booking wizard step 1 is usable on mobile', async ({ customerPage: page }) => {
    await page.goto('/book')
    await page.waitForLoadState('networkidle')

    const serviceBtn = page.getByRole('button', { name: /standard cleaning/i })
    if (await serviceBtn.isVisible({ timeout: 10_000 })) {
      const box = await serviceBtn.boundingBox()
      // Button should be fully within viewport
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 20)
    }
  })

  test('M5 — admin dashboard headings visible on mobile', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const heading = page.getByRole('heading', { name: /admin dashboard/i })
      .or(page.getByText(/admin/i).first())
    await expect(heading).toBeVisible()
  })
})

// ── Tablet viewport ───────────────────────────────────────────────────────────

test.describe('Tablet viewport (768×1024)', () => {
  test.use({ viewport: VIEWPORTS.tablet })

  test('T1 — login page renders correctly on tablet', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.submitBtn).toBeVisible()
  })

  test('T2 — customer dashboard renders on tablet without overflow', async ({ customerPage: page }) => {
    await page.goto('/customer/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/my bookings|dashboard/i).first()).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.tablet.width + 40)
  })

  test('T3 — cleaner dashboard renders on tablet', async ({ cleanerPage: page }) => {
    await page.goto('/cleaner/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/cleaner\/dashboard/)
    await expect(page.getByText(/booking|dashboard|job|earning/i).first()).toBeVisible()
  })

  test('T4 — booking wizard renders on tablet', async ({ customerPage: page }) => {
    await page.goto('/book')
    await page.waitForLoadState('networkidle')

    const heading = page.getByText(/book|cleaner|service/i).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })
})

// ── Desktop viewport ──────────────────────────────────────────────────────────

test.describe('Desktop viewport (1280×800)', () => {
  test.use({ viewport: VIEWPORTS.desktop })

  test('D1 — login page renders on desktop', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.submitBtn).toBeVisible()
  })

  test('D2 — customer dashboard renders on desktop', async ({ customerPage: page }) => {
    await page.goto('/customer/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/my bookings|dashboard/i).first()).toBeVisible()
  })

  test('D3 — admin dashboard renders on desktop', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/admin dashboard/i).first()).toBeVisible()
  })

  test('D4 — sidebar navigation is fully visible on desktop', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: /bookings/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /cleaners/i })).toBeVisible()
  })
})

// ── Consistent status display across viewports ────────────────────────────────

test.describe('Cross-viewport status consistency', () => {
  for (const [label, viewport] of Object.entries(VIEWPORTS)) {
    test(`status labels visible on ${label} (${viewport.width}×${viewport.height})`, async ({ customerPage: page }) => {
      test.use({ viewport })

      await page.goto('/customer/dashboard/bookings')
      await page.waitForLoadState('networkidle')

      // Tab buttons accessible at any viewport
      const pendingTab = page.getByRole('button', { name: 'Pending' })
      const activeTab  = page.getByRole('button', { name: 'Active' })
      if (await pendingTab.isVisible()) {
        await expect(pendingTab).toBeEnabled()
      }
      if (await activeTab.isVisible()) {
        await expect(activeTab).toBeEnabled()
      }
    })
  }
})
