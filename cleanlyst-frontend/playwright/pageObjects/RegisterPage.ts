import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/signup')
    await this.page.waitForLoadState('networkidle')
  }

  get fullNameInput()   { return this.page.getByLabel(/full name/i) }
  get emailInput()      { return this.page.getByLabel(/email/i) }
  get passwordInput()   { return this.page.getByLabel(/^password/i).first() }
  get confirmInput()    { return this.page.getByLabel(/confirm password/i) }
  get submitBtn()       { return this.page.getByRole('button', { name: /register|create account/i }) }
  get errorMessage()    { return this.page.getByText(/already|invalid|error/i).first() }
  get loginLink()       { return this.page.getByRole('link', { name: /log in|sign in/i }) }

  async selectRole(role: 'customer' | 'cleaner'): Promise<void> {
    const byBtn = this.page.getByRole('button', { name: new RegExp(role, 'i') })
    if (await byBtn.isVisible()) { await byBtn.click(); return }
    // Role cards: <label> wrapping a visually-hidden radio with an intercepting
    // overlay div inside. Click the label itself (overlay is a descendant so
    // Playwright allows it); avoid clicking the radio directly which the overlay
    // would intercept.
    const byCard = this.page.locator('label').filter({ hasText: new RegExp(role, 'i') }).first()
    if (await byCard.isVisible()) { await byCard.click(); return }
    // Fallback: standard accessible radio (no overlay)
    const byRadio = this.page.getByLabel(new RegExp(role, 'i'))
    if (await byRadio.isVisible()) await byRadio.click()
  }

  async fill(data: {
    fullName: string
    email: string
    password: string
    role?: 'customer' | 'cleaner'
  }): Promise<void> {
    // Select role first so any role-dependent fields (e.g. Business Name) appear
    if (data.role) await this.selectRole(data.role)
    // Full Name is optional — the current signup form does not include it
    if (await this.fullNameInput.isVisible()) {
      await this.fullNameInput.fill(data.fullName)
    }
    await this.emailInput.fill(data.email)
    await this.passwordInput.fill(data.password)
    if (await this.confirmInput.isVisible()) {
      await this.confirmInput.fill(data.password)
    }
    // Business Name field is shown on signup for cleaner role; use fullName as the value
    const businessInput = this.page.getByLabel(/business name/i)
    if (await businessInput.isVisible()) {
      await businessInput.fill(data.fullName)
    }
  }

  async submit(): Promise<void> {
    await this.submitBtn.click()
  }

  async registerAndWait(data: {
    fullName: string
    email: string
    password: string
    role?: 'customer' | 'cleaner'
  }): Promise<void> {
    await this.fill(data)
    await this.submit()
    await expect(this.page).toHaveURL(/dashboard|onboarding|verify/, { timeout: 20_000 })
  }
}
