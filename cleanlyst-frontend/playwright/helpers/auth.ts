import type { Page, BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/customer|cleaner|admin/, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
}

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
}

// ─── Registration ─────────────────────────────────────────────────────────────

export interface RegistrationData {
  email: string
  password: string
  fullName: string
  phone?: string
}

export async function registerCustomer(page: Page, data: RegistrationData): Promise<void> {
  await page.goto('/auth/register')
  await page.waitForLoadState('networkidle')

  await page.getByLabel(/full name/i).fill(data.fullName)
  await page.getByLabel(/email/i).fill(data.email)
  await page.getByLabel(/password/i).first().fill(data.password)

  const confirmLabel = page.getByLabel(/confirm password/i)
  if (await confirmLabel.isVisible()) {
    await confirmLabel.fill(data.password)
  }

  // Role selector: customer should already be default — only click if there's a choice
  const customerOption = page.getByRole('button', { name: /customer/i })
  if (await customerOption.isVisible()) {
    await customerOption.click()
  }

  await page.getByRole('button', { name: /register|sign up|create account/i }).click()
  await expect(page).toHaveURL(/customer\/dashboard|onboarding|verify/, { timeout: 20_000 })
}

export async function registerCleaner(page: Page, data: RegistrationData): Promise<void> {
  await page.goto('/auth/register')
  await page.waitForLoadState('networkidle')

  await page.getByLabel(/full name/i).fill(data.fullName)
  await page.getByLabel(/email/i).fill(data.email)
  await page.getByLabel(/password/i).first().fill(data.password)

  const confirmLabel = page.getByLabel(/confirm password/i)
  if (await confirmLabel.isVisible()) {
    await confirmLabel.fill(data.password)
  }

  const cleanerOption = page.getByRole('button', { name: /cleaner/i })
  if (await cleanerOption.isVisible()) {
    await cleanerOption.click()
  } else {
    const cleanerRadio = page.getByLabel(/cleaner/i)
    if (await cleanerRadio.isVisible()) await cleanerRadio.click()
  }

  await page.getByRole('button', { name: /register|sign up|create account/i }).click()
  await expect(page).toHaveURL(/cleaner\/dashboard|onboarding/, { timeout: 20_000 })
}

// ─── Saved auth state ─────────────────────────────────────────────────────────

export async function saveAuthState(context: BrowserContext, storageFile: string): Promise<void> {
  await context.storageState({ path: storageFile })
}
