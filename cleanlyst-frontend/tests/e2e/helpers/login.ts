import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(/customer|cleaner|admin/, { timeout: 15_000 })
  // Wait for the dashboard to finish loading all async data before the test proceeds.
  await page.waitForLoadState('networkidle')
}

export async function logout(page: Page): Promise<void> {
  // Clear auth state fully before navigating — prevents in-flight Supabase requests
  // from racing with the next loginAs() call.
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/auth/login')
  // Wait for the page to settle so the Supabase client re-initialises cleanly
  await page.waitForLoadState('networkidle')
}
