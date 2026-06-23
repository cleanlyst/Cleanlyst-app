import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { futureDate, PROPERTY_DATA } from '../helpers/dataFactory'

export interface WizardOptions {
  daysAhead?:   number
  time?:        string
  propertyType?: string
  bedrooms?:    string
  bathrooms?:   string
  address1?:    string
  postcode?:    string
}

export class BookingWizard {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/book')
    await expect(this.page.locator('text=Book Cleaner')).toBeVisible({ timeout: 15_000 })
  }

  // ── Step 1 — service ────────────────────────────────────────────────────────

  async selectService(name = 'Standard Cleaning'): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(name, 'i') }).click()
    await this.page.getByRole('button', { name: /continue/i }).click()
  }

  // ── Step 2 — schedule ───────────────────────────────────────────────────────

  async fillSchedule(opts: Pick<WizardOptions, 'daysAhead' | 'time'> = {}): Promise<void> {
    await this.page.getByLabel('Date').fill(futureDate(opts.daysAhead ?? 3))
    await this.page.getByLabel('Start Time').fill(opts.time ?? '10:00')
    await this.page.getByRole('button', { name: /continue/i }).click()
  }

  // ── Step 3 — property details ───────────────────────────────────────────────

  async fillProperty(opts: Pick<WizardOptions, 'propertyType' | 'bedrooms' | 'bathrooms' | 'address1' | 'postcode'> = {}): Promise<void> {
    await this.page.getByLabel('Property Type').selectOption(opts.propertyType ?? PROPERTY_DATA.propertyType)
    await this.page.getByLabel('Bedrooms').selectOption(opts.bedrooms ?? PROPERTY_DATA.bedrooms)
    await this.page.getByLabel('Bathrooms').selectOption(opts.bathrooms ?? PROPERTY_DATA.bathrooms)
    await this.page.getByPlaceholder('Address line 1').fill(opts.address1 ?? PROPERTY_DATA.addressLine1)
    await this.page.getByPlaceholder('Postcode').fill(opts.postcode ?? PROPERTY_DATA.postcode)
    await this.page.getByRole('button', { name: /continue/i }).click()
  }

  // ── Step 4 — cleaner selection ──────────────────────────────────────────────

  async selectFirstCleaner(): Promise<void> {
    await expect(this.page.locator('text=Available Cleaners')).toBeVisible({ timeout: 20_000 })
    await this.page.getByRole('button', { name: /^book$/i }).first().click()
  }

  // ── Step 5 — confirm & pay ──────────────────────────────────────────────────

  async confirmAndPay(): Promise<void> {
    const btn = this.page.getByTestId('confirm-pay-btn')
      .or(this.page.getByRole('button', { name: /confirm and pay/i }))
    await expect(btn).toBeEnabled({ timeout: 15_000 })
    await btn.click()
    await expect(this.page.locator('text=Payment Successful')).toBeVisible({ timeout: 30_000 })
  }

  async dismissSuccess(): Promise<void> {
    const continueBtn = this.page.getByRole('button', { name: /continue/i })
    if (await continueBtn.isVisible()) await continueBtn.click()
    await expect(this.page).toHaveURL(/customer\/dashboard/, { timeout: 10_000 })
  }

  // ── Full happy-path convenience ─────────────────────────────────────────────

  async completeFullJourney(opts: WizardOptions = {}): Promise<void> {
    await this.goto()
    await this.selectService()
    await this.fillSchedule(opts)
    await this.fillProperty(opts)
    await this.selectFirstCleaner()
    await this.confirmAndPay()
    await this.dismissSuccess()
  }

  // ── Partial: up to cleaner selection (no payment) ──────────────────────────

  async fillThroughCleanerSelection(opts: WizardOptions = {}): Promise<void> {
    await this.goto()
    await this.selectService()
    await this.fillSchedule(opts)
    await this.fillProperty(opts)
    await this.selectFirstCleaner()
  }
}
