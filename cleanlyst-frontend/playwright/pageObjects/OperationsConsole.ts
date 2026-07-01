import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class OperationsConsole {
  constructor(private page: Page) {}

  async goto(bookingId?: string) {
    const path = bookingId ? `/admin/ops/${bookingId}` : '/admin/ops'
    await this.page.goto(path)
    await this.page.waitForLoadState('networkidle')
  }

  get searchInput() {
    return this.page.locator('input[placeholder*="Booking UUID"]')
      .or(this.page.locator('input[placeholder*="email"]'))
      .first()
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
  }

  async selectFirstResult() {
    // Search results render as <button> elements (not divs) containing the UUID text.
    // getByRole('button') avoids matching the container div which shares border/outline classes.
    const result = this.page.getByRole('button').filter({ hasText: /[0-9a-f]{8}-/ }).first()
    if (await result.isVisible({ timeout: 8_000 })) {
      await result.click()
      await this.page.waitForLoadState('networkidle')
      return true
    }
    return false
  }

  get bookingSummary() {
    // BookingSummaryCard has no heading — detect bundle load via the always-present
    // Financial Summary OpsSection title which renders immediately after the card.
    return this.page.getByText(/financial summary|event timeline/i).first()
  }

  get financialSummary() {
    return this.page.getByText(/financial summary/i).first()
  }

  get timeline() {
    return this.page.getByText(/event timeline/i).first()
  }

  get ledger() {
    return this.page.getByText(/ledger events/i).first()
  }

  get investigation() {
    return this.page.getByText(/investigation/i).first()
  }

  get notifications() {
    return this.page.getByText(/notifications/i).first()
  }

  get webhooks() {
    return this.page.getByText(/webhook events/i).first()
  }

  get actions() {
    return this.page.getByText(/^actions$/i).first()
  }

  get liveIndicator() {
    return this.page.getByText(/live/i).first()
  }

  get emptyState() {
    return this.page.getByText(/search for a booking/i).first()
  }

  get noResults() {
    return this.page.getByText(/no results found/i).first()
  }

  async assertBundleLoaded() {
    await expect(this.bookingSummary).toBeVisible({ timeout: 15_000 })
    await expect(this.financialSummary).toBeVisible({ timeout: 10_000 })
    await expect(this.timeline).toBeVisible({ timeout: 10_000 })
    await expect(this.ledger).toBeVisible({ timeout: 10_000 })
  }

  async expandSection(sectionText: string | RegExp) {
    const header = this.page.getByText(sectionText).first()
    if (await header.isVisible({ timeout: 5_000 })) {
      await header.click()
      await this.page.waitForTimeout(500)
    }
  }

  async assertNoErrors() {
    await expect(this.page.getByText(/failed to load|error loading/i)).not.toBeVisible()
  }
}
