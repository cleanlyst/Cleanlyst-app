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

  refundBtn(_bookingId: string) {
    // The refund is triggered via the global "Process Refund" system override card
    return this.page.locator('[data-testid="open-refund-modal"]')
      .or(this.page.getByRole('button', { name: /process refund/i }).first())
  }

  async issueRefund(bookingId: string): Promise<void> {
    const openBtn = this.page.locator('[data-testid="open-refund-modal"]')
    await expect(openBtn).toBeVisible({ timeout: 15_000 })
    await openBtn.click()

    // Fill booking ID and look up
    const bookingIdInput = this.page.locator('#refund-booking-id')
    await expect(bookingIdInput).toBeVisible({ timeout: 5_000 })
    await bookingIdInput.fill(bookingId)
    await this.page.getByRole('button', { name: /look up/i }).click()

    // Wait for booking details (reason select appears after successful lookup)
    const reasonSelect = this.page.locator('#refund-reason')
    await expect(reasonSelect).toBeVisible({ timeout: 10_000 })

    const partialRadio = this.page.locator('input[type="radio"][value="partial"]')
    if (await partialRadio.isVisible({ timeout: 3_000 })) {
      await partialRadio.click()
      const amountInput = this.page.locator('#refund-amount')
      await expect(amountInput).toBeVisible({ timeout: 3_000 })
      await amountInput.fill('10.00')
    }

    await reasonSelect.selectOption('customer_cancellation')

    // Submit refund
    const confirmBtn = this.page.locator('[data-testid="confirm-refund-btn"]')
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
    await confirmBtn.click()

    // Wait for either the success result or an error message
    const resultEl = this.page.locator('[class*="refund-result"]').first()
    const errorEl  = this.page.locator('.reassign-error').first()
    await Promise.race([
      resultEl.waitFor({ state: 'visible', timeout: 15_000 }),
      errorEl.waitFor({ state: 'visible', timeout: 15_000 }),
    ])
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
    await this.page.goto(`/admin/bookings/${bookingId}`)
    await this.page.waitForLoadState('networkidle')
    // Booking detail page shows a status pill when the booking is found
    await expect(
      this.page.locator('[class*="status-pill"]').first(),
    ).toBeVisible({ timeout: 10_000 })
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
