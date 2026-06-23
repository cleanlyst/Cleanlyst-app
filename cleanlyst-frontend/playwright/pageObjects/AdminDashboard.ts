import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class AdminDashboard {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/dashboard')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoCleaners() {
    await this.page.goto('/admin/dashboard/cleaners')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoBookings() {
    await this.page.goto('/admin/dashboard/bookings')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoBookingAudit() {
    await this.page.goto('/admin/dashboard/booking-audit')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoFinancialAudit() {
    await this.page.goto('/admin/dashboard/financial-audit')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Navigation assertions ──────────────────────────────────────────────────────

  async assertOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/admin\/dashboard/)
    await expect(this.page.getByText(/admin dashboard/i).first()).toBeVisible()
  }

  // ── Cleaner approval ───────────────────────────────────────────────────────────

  approveBtn(userId: string) {
    return this.page.locator(`[data-testid="approve-cleaner-btn"][data-user-id="${userId}"]`)
      .or(this.page.getByRole('button', { name: /approve/i }).first())
  }

  rejectBtn(userId: string) {
    return this.page.locator(`[data-testid="reject-cleaner-btn"][data-user-id="${userId}"]`)
      .or(this.page.getByRole('button', { name: /reject/i }).first())
  }

  async approveCleaner(userId: string): Promise<void> {
    const btn = this.approveBtn(userId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm|yes, approve/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 })
  }

  async rejectCleaner(userId: string): Promise<void> {
    const btn = this.rejectBtn(userId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm|yes, reject/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/rejected/i).first()).toBeVisible({ timeout: 15_000 })
  }

  // ── Payout management ─────────────────────────────────────────────────────────

  releasePayoutBtn(bookingId: string) {
    return this.page.locator(`[data-testid="release-payout-btn"][data-booking-id="${bookingId}"]`)
      .or(this.page.getByRole('button', { name: /release payout/i }).first())
  }

  async releasePayout(bookingId: string): Promise<void> {
    const btn = this.releasePayoutBtn(bookingId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm|yes/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/payout released|payout sent/i).first()).toBeVisible({ timeout: 15_000 })
  }

  // ── Refund management ──────────────────────────────────────────────────────────

  refundBtn(bookingId: string) {
    return this.page.locator(`[data-testid="refund-btn"][data-booking-id="${bookingId}"]`)
      .or(this.page.getByRole('button', { name: /refund/i }).first())
  }

  async issueRefund(bookingId: string): Promise<void> {
    const btn = this.refundBtn(bookingId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm|yes, refund/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/refund issued|refunded/i).first()).toBeVisible({ timeout: 15_000 })
  }

  // ── Reassignment ──────────────────────────────────────────────────────────────

  async reassignBooking(bookingId: string): Promise<void> {
    const btn = this.page.locator(`[data-testid="reassign-btn"][data-booking-id="${bookingId}"]`)
      .or(this.page.getByRole('button', { name: /reassign/i }).first())
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
  }

  // ── Investigation timeline ─────────────────────────────────────────────────────

  async viewInvestigationTimeline(bookingId: string): Promise<void> {
    await this.page.goto(`/admin/dashboard/bookings/${bookingId}`)
    await this.page.waitForLoadState('networkidle')
    const timeline = this.page.getByTestId('booking-timeline')
      .or(this.page.locator('[class*="timeline"]').first())
    await expect(timeline).toBeVisible({ timeout: 10_000 })
  }

  // ── Audit tables ──────────────────────────────────────────────────────────────

  async assertAuditTableVisible(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: 'Booking ID' })).toBeVisible({ timeout: 10_000 })
  }

  // ── Ledger view ───────────────────────────────────────────────────────────────

  async assertLedgerVisible(): Promise<void> {
    await expect(
      this.page.getByText(/ledger|financial/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  }
}
