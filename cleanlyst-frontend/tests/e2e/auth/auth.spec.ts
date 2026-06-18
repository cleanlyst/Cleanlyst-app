import { test, expect } from '@playwright/test'
import { TEST_ENV } from '../utils'
import { loginAs, logout } from '../helpers/login'

test.describe('Authentication and role guards', () => {
  test('customer can login and reach dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await expect(page).toHaveURL(/customer\/dashboard/)
    await expect(page.locator('text=My Bookings')).toBeVisible()
  })

  test('cleaner can login and reach cleaner dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await expect(page).toHaveURL(/cleaner\/dashboard/)
  })

  test('admin can login and reach admin dashboard', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await expect(page).toHaveURL(/admin\/dashboard/)
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()
  })

  test('unauthenticated user is redirected to login from protected route', async ({ page }) => {
    await page.goto('/customer/dashboard')
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('customer logout clears session and redirects to login', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await expect(page).toHaveURL(/customer\/dashboard/)
    await logout(page)
    await expect(page).toHaveURL(/auth\/login/)
    await page.goto('/customer/dashboard')
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('admin is redirected away from cleaner pages', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD)
    await page.goto('/cleaner/dashboard')
    await expect(page).not.toHaveURL(/cleaner\/dashboard/)
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()
  })

  test('customer is redirected away from admin pages', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD)
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/admin\/dashboard/)
  })

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email Address').fill('notareal@email.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /log in/i }).click()
    await expect(page).toHaveURL(/auth\/login/)
    await expect(page.locator('text=Invalid').first()).toBeVisible({ timeout: 10_000 })
  })
})
