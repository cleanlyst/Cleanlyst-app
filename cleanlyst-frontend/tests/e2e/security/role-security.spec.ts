import { test, expect } from '@playwright/test'
import { TEST_ENV } from '../utils'
import { loginAs } from '../helpers/login'

test.describe('Role-based route security', () => {
  test('unauthenticated user is redirected to login from customer dashboard', async ({ page }) => {
    await page.goto('/customer/dashboard')
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('unauthenticated user is redirected to login from cleaner dashboard', async ({ page }) => {
    await page.goto('/cleaner/dashboard')
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('unauthenticated user is redirected to login from admin dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('customer cannot access cleaner dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/cleaner/dashboard')
    await expect(page).not.toHaveURL(/cleaner\/dashboard/)
    await expect(page).toHaveURL(/customer\/dashboard/)
  })

  test('customer cannot access admin dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/admin\/dashboard/)
  })

  test('cleaner cannot access customer dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/customer/dashboard')
    await expect(page).not.toHaveURL(/customer\/dashboard/)
    await expect(page).toHaveURL(/cleaner\/dashboard/)
  })

  test('cleaner cannot access admin dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/admin\/dashboard/)
    await expect(page).toHaveURL(/cleaner\/dashboard/)
  })

  test('admin cannot access cleaner dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/cleaner/dashboard')
    await expect(page).not.toHaveURL(/cleaner\/dashboard/)
    await expect(page).toHaveURL(/admin\/dashboard/)
  })

  test('admin cannot access customer dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/customer/dashboard')
    await expect(page).not.toHaveURL(/customer\/dashboard/)
    await expect(page).toHaveURL(/admin\/dashboard/)
  })

  test('admin can access booking audit page', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/admin/dashboard/booking-audit')
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Booking Audit' })).toBeVisible()
  })

  test('customer cannot access admin booking audit page', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/admin/dashboard/booking-audit')
    await expect(page).not.toHaveURL(/admin\/dashboard/)
  })
})
