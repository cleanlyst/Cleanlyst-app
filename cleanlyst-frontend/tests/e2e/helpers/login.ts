import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/customer|cleaner|admin/, { timeout: 15_000 })
}

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear())
  await page.goto('/auth/login')
}
