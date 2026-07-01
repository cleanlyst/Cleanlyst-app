import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'manual'

export class FinancialClose {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/financial-close')
    await this.page.waitForLoadState('networkidle')
  }

  get heading() {
    return this.page.getByRole('heading', { name: /financial close/i })
  }

  get runCloseButton() {
    return this.page.getByRole('button', { name: /run close/i })
  }

  get runningSpinner() {
    return this.page.getByText(/running/i)
  }

  periodButton(type: PeriodType) {
    const labels: Record<PeriodType, string> = {
      daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', manual: 'Manual',
    }
    // Use .first() — the period type selector button appears before close history items
    // which also contain the period label in their text
    return this.page.getByRole('button', { name: new RegExp(labels[type], 'i') }).first()
  }

  get dateInput() {
    return this.page.locator('input[type="date"]').first()
  }

  get manualStartInput() {
    return this.page.locator('input[type="date"]').nth(0)
  }

  get manualEndInput() {
    return this.page.locator('input[type="date"]').nth(1)
  }

  async selectPeriodType(type: PeriodType) {
    await this.periodButton(type).click()
  }

  async setDate(dateStr: string) {
    await this.dateInput.fill(dateStr)
  }

  async setManualRange(start: string, end: string) {
    await this.manualStartInput.fill(start)
    await this.manualEndInput.fill(end)
  }

  async runClose(): Promise<void> {
    await expect(this.runCloseButton).toBeEnabled({ timeout: 5_000 })
    await this.runCloseButton.click()
    // Wait for the run to complete (spinner appears then disappears)
    await this.page.waitForFunction(
      () => !document.body.textContent?.includes('Running…'),
      { timeout: 30_000 },
    )
  }

  get historyList() {
    return this.page.locator('[class*="history"], [class*="close-list"]').first()
      .or(this.page.getByText(/close history|past closes|previous closes/i).first())
  }

  get metricsGrid() {
    return this.page.getByText(/gross revenue|net revenue/i).first()
  }

  get reconciliationSection() {
    return this.page.getByText(/reconciliation/i).first()
  }

  get cashPosition() {
    return this.page.getByText(/cash position/i).first()
  }

  downloadCsvButton() {
    return this.page.getByRole('button', { name: /^csv$/i })
  }

  downloadJsonButton() {
    return this.page.getByRole('button', { name: /^json$/i })
  }

  printButton() {
    // Use .first() — history entries may also contain "Print" buttons, causing strict violations
    return this.page.getByRole('button', { name: /print/i }).first()
  }

  async assertCloseResultLoaded() {
    await expect(this.metricsGrid).toBeVisible({ timeout: 15_000 })
    await expect(this.reconciliationSection).toBeVisible({ timeout: 10_000 })
    await expect(this.cashPosition).toBeVisible({ timeout: 10_000 })
  }

  async assertRunError() {
    return this.page.getByText(/error|failed|blocked/i).first()
  }

  pastDateStr(daysBack = 30): string {
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    return d.toISOString().slice(0, 10)
  }
}
