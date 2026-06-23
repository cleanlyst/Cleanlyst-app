import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/register')
    await this.page.waitForLoadState('networkidle')
  }

  get fullNameInput()   { return this.page.getByLabel(/full name/i) }
  get emailInput()      { return this.page.getByLabel(/email/i) }
  get passwordInput()   { return this.page.getByLabel(/^password/i).first() }
  get confirmInput()    { return this.page.getByLabel(/confirm password/i) }
  get submitBtn()       { return this.page.getByRole('button', { name: /register|sign up|create account/i }) }
  get errorMessage()    { return this.page.getByText(/already|invalid|error/i).first() }
  get loginLink()       { return this.page.getByRole('link', { name: /log in|sign in/i }) }

  async selectRole(role: 'customer' | 'cleaner'): Promise<void> {
    const byBtn   = this.page.getByRole('button', { name: new RegExp(role, 'i') })
    const byRadio = this.page.getByLabel(new RegExp(role, 'i'))
    if (await byBtn.isVisible())   { await byBtn.click(); return }
    if (await byRadio.isVisible()) { await byRadio.click() }
  }

  async fill(data: {
    fullName: string
    email: string
    password: string
    role?: 'customer' | 'cleaner'
  }): Promise<void> {
    await this.fullNameInput.fill(data.fullName)
    await this.emailInput.fill(data.email)
    await this.passwordInput.fill(data.password)
    if (await this.confirmInput.isVisible()) {
      await this.confirmInput.fill(data.password)
    }
    if (data.role) await this.selectRole(data.role)
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
