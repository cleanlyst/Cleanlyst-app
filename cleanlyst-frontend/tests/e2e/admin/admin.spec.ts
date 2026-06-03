import { test, expect } from '@playwright/test'
import { TEST_ENV } from '../utils'
import { loginAs } from '../helpers/login'

test.describe('Admin dashboard workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
  })

  test('admin sees admin dashboard with key sections', async ({ page }) => {
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()
  })

  test('admin can navigate to booking management', async ({ page }) => {
    await page.goto('/admin/dashboard/bookings')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.locator('text=Booking Management').or(page.locator('text=Bookings'))).toBeVisible()
  })

  test('admin can navigate to booking audit page', async ({ page }) => {
    await page.goto('/admin/dashboard/booking-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.locator('text=Booking Audit')).toBeVisible()
  })

  test('admin booking audit shows event log table', async ({ page }) => {
    await page.goto('/admin/dashboard/booking-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    // Table headers should be present
    await expect(
      page.locator('text=Booking ID').or(page.locator('text=From Status').or(page.locator('text=Actor'))),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('admin can navigate to financial audit', async ({ page }) => {
    await page.goto('/admin/dashboard/financial-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.locator('text=Financial').or(page.locator('text=Revenue'))).toBeVisible({ timeout: 10_000 })
  })

  test('admin can access cleaner management', async ({ page }) => {
    await page.goto('/admin/dashboard/cleaners')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.locator('text=Cleaner').or(page.locator('text=Cleaners'))).toBeVisible({ timeout: 10_000 })
  })

  test('admin dashboard sidebar navigation links are all present', async ({ page }) => {
    await expect(page.locator('text=Bookings')).toBeVisible()
    await expect(page.locator('text=Cleaners')).toBeVisible()
  })
})
