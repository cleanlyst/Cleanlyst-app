import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/login')
    await this.page.waitForLoadState('networkidle')
  }

  get emailInput()    { return this.page.getByLabel('Email Address') }
  get passwordInput() { return this.page.getByLabel('Password') }
  get submitBtn()     { return this.page.locator('form button[type="submit"]') }
  get errorMessage()  { return this.page.getByText(/invalid|incorrect|wrong|error/i).first() }
  get registerLink()  { return this.page.getByRole('link', { name: /register|sign up/i }) }
  get forgotLink()    { return this.page.getByRole('link', { name: /forgot/i }) }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitBtn.click()
    await expect(this.page).toHaveURL(/customer|cleaner|admin/, { timeout: 15_000 })
    await this.page.waitForLoadState('networkidle')
  }

  async attemptLogin(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitBtn.click()
  }

  async isOnPage(): Promise<boolean> {
    return this.page.url().includes('/auth/login')
  }
}
