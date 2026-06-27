import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class BookingDetail {
  constructor(private page: Page) {}

  async gotoCustomer(bookingId: string) {
    await this.page.goto(`/customer/bookings/${bookingId}`)
    await this.page.waitForLoadState('networkidle')
  }

  async gotoCleaner(bookingId: string) {
    await this.page.goto(`/cleaner/bookings/${bookingId}`)
    await this.page.waitForLoadState('networkidle')
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  get statusBadge() { return this.page.getByTestId('booking-status').or(this.page.locator('[class*="status"]').first()) }
  get timeline()    { return this.page.getByTestId('booking-timeline').or(this.page.locator('[class*="timeline"]').first()) }

  async hasStatus(statusText: string | RegExp): Promise<void> {
    await expect(
      this.page.locator('[class*="status-pill"]').filter({ hasText: statusText }),
    ).toBeVisible({ timeout: 10_000 })
  }

  // ── Customer actions ─────────────────────────────────────────────────────────

  get cancelBtn()         { return this.page.getByRole('button', { name: /cancel/i }) }
  get approveEstimateBtn(){ return this.page.getByRole('button', { name: /approve estimate/i }) }
  get confirmCompleteBtn(){ return this.page.getByRole('button', { name: /confirm completion|mark complete/i }) }
  get leaveReviewBtn()    { return this.page.getByRole('button', { name: /leave review|rate/i }) }
  get rebookBtn()         { return this.page.getByRole('button', { name: /rebook/i }) }

  async cancel(): Promise<void> {
    await this.cancelBtn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm cancel|yes, cancel/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/cancelled/i).first()).toBeVisible({ timeout: 15_000 })
  }

  // ── Cleaner actions ──────────────────────────────────────────────────────────

  get acceptBtn()        { return this.page.getByRole('button', { name: /accept/i }) }
  get declineBtn()       { return this.page.getByRole('button', { name: /decline/i }) }
  get startCleaningBtn() { return this.page.getByRole('button', { name: /start cleaning/i }) }
  get completeBtn()      { return this.page.getByRole('button', { name: /complete|end cleaning/i }) }
  get submitEstimateBtn(){ return this.page.getByRole('button', { name: /submit estimate/i }) }
  get cannotAttendBtn()  { return this.page.getByRole('button', { name: /cannot attend|unavailable/i }) }

  async accept(): Promise<void> {
    await this.acceptBtn.click()
    await expect(this.page.getByText(/accepted|confirmed/i).first()).toBeVisible({ timeout: 10_000 })
  }

  async decline(): Promise<void> {
    await this.declineBtn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm|yes/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/declined/i).first()).toBeVisible({ timeout: 10_000 })
  }

  async submitEstimate(amount: string, note = 'Revised estimate for additional work'): Promise<void> {
    const estimateInput = this.page.getByLabel(/estimate amount|revised amount/i)
    if (await estimateInput.isVisible()) await estimateInput.fill(amount)
    const noteInput = this.page.getByLabel(/note|reason/i)
    if (await noteInput.isVisible()) await noteInput.fill(note)
    await this.submitEstimateBtn.click()
    await expect(this.page.getByText(/estimate submitted|pending approval/i).first()).toBeVisible({ timeout: 10_000 })
  }

  // ── Review form ───────────────────────────────────────────────────────────────

  async leaveReview(rating: 1 | 2 | 3 | 4 | 5 = 5, comment = 'Excellent service'): Promise<void> {
    await this.leaveReviewBtn.click()
    const starBtn = this.page.locator(`[data-rating="${rating}"]`).or(this.page.getByLabel(`${rating} star`))
    if (await starBtn.isVisible()) await starBtn.click()
    const commentInput = this.page.getByLabel(/comment|review|message/i)
    if (await commentInput.isVisible()) await commentInput.fill(comment)
    await this.page.getByRole('button', { name: /submit review|post review/i }).click()
    await expect(this.page.getByText(/thank you|review submitted/i).first()).toBeVisible({ timeout: 10_000 })
  }

  // ── Timeline assertions ───────────────────────────────────────────────────────

  async timelineHasEntry(pattern: string | RegExp): Promise<void> {
    await expect(this.page.getByText(pattern)).toBeVisible({ timeout: 10_000 })
  }
}
