import { test, expect } from '@playwright/test'
import { TEST_ENV } from '../utils'
import { loginAs } from '../helpers/login'

test.describe('Admin dashboard workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
  })

  test('admin sees admin dashboard with key sections', async ({ page }) => {
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()
  })

  test('admin can navigate to booking management', async ({ page }) => {
    await page.goto('/admin/dashboard/bookings')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(
      page.getByRole('heading', { name: /booking management/i }).or(
        page.getByRole('heading', { name: /bookings/i }),
      ),
    ).toBeVisible()
  })

  test('admin can navigate to booking audit page', async ({ page }) => {
    await page.goto('/admin/dashboard/booking-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: /booking audit/i })).toBeVisible()
  })

  test('admin booking audit shows event log table', async ({ page }) => {
    await page.goto('/admin/dashboard/booking-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    // Check one specific column header that uniquely identifies the audit table
    await expect(page.getByRole('columnheader', { name: 'Booking ID' })).toBeVisible({ timeout: 10_000 })
  })

  test('admin can navigate to financial audit', async ({ page }) => {
    await page.goto('/admin/dashboard/financial-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(
      page.getByRole('heading', { name: /financial/i }).or(
        page.getByRole('heading', { name: /revenue/i }),
      ),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('admin can access cleaner management', async ({ page }) => {
    await page.goto('/admin/dashboard/cleaners')
    await expect(page).toHaveURL(/admin\/dashboard/)
    // Page heading is "Pending Cleaner Applications"
    await expect(
      page.getByRole('heading', { name: /pending cleaner applications/i }).or(
        page.getByRole('heading', { name: /cleaner/i }),
      ).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('admin dashboard sidebar navigation links are all present', async ({ page }) => {
    // Check sidebar nav links specifically — avoids matching page headings or table headers
    await expect(page.getByRole('navigation').getByRole('link', { name: /bookings/i })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link', { name: /cleaners/i })).toBeVisible()
  })
})
