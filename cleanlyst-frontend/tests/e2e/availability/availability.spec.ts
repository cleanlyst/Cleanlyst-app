import { test, expect } from '@playwright/test'
import { TEST_ENV } from '../utils'
import { loginAs } from '../helpers/login'

test.describe('Cleaner availability workflow', () => {
  test('cleaner can update, persist, and reload weekly schedule', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)

    await page.goto('/cleaner/dashboard/availability')
    await expect(page.locator('text=Weekly schedule')).toBeVisible()

    const mondayStart = page.getByLabel('Monday start time')
    await mondayStart.fill('10:00')
    await page.getByRole('button', { name: /save weekly schedule/i }).click()
    await expect(page.locator('text=Schedule saved successfully.')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Monday start time')).toHaveValue('10:00')
  })

  test('cleaner availability persists after logout and login', async ({ page }) => {
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/availability')
    await expect(page.locator('text=Weekly schedule')).toBeVisible()

    await page.getByLabel('Tuesday start time').fill('08:00')
    await page.getByRole('button', { name: /save weekly schedule/i }).click()
    await expect(page.locator('text=Schedule saved successfully.')).toBeVisible()

    await page.evaluate(() => localStorage.clear())
    await loginAs(page, TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD)
    await page.goto('/cleaner/dashboard/availability')
    await expect(page.getByLabel('Tuesday start time')).toHaveValue('08:00')
  })
})
