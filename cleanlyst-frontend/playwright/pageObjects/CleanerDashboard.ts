import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class CleanerDashboard {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/cleaner/dashboard')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoBookings() {
    await this.page.goto('/cleaner/dashboard/bookings')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoEarnings() {
    await this.page.goto('/cleaner/dashboard/earnings')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Tab navigation ────────────────────────────────────────────────────────────

  async switchTab(name: 'Pending' | 'Active' | 'Completed' | 'All'): Promise<void> {
    await this.page.getByRole('button', { name }).click()
    await this.page.waitForLoadState('networkidle')
  }

  // ── Per-booking action buttons (use data-booking-id for determinism) ───────────

  acceptBtn(bookingId: string) {
    return this.page.locator(`[data-testid="accept-booking-btn"][data-booking-id="${bookingId}"]`)
      .or(this.page.getByRole('button', { name: /accept/i }).first())
  }

  startBtn(bookingId: string) {
    return this.page.locator(`[data-testid="start-cleaning-btn"][data-booking-id="${bookingId}"]`)
      .or(this.page.getByRole('button', { name: /start cleaning/i }).first())
  }

  declineBtn(bookingId: string) {
    return this.page.locator(`[data-testid="decline-booking-btn"][data-booking-id="${bookingId}"]`)
      .or(this.page.getByRole('button', { name: /decline/i }).first())
  }

  // ── Accept ─────────────────────────────────────────────────────────────────────

  async acceptBooking(bookingId: string): Promise<void> {
    const btn = this.acceptBtn(bookingId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    await expect(
      this.page.locator('text=Ready to Start').or(this.page.getByTestId('start-cleaning-btn')).first(),
    ).toBeVisible({ timeout: 15_000 })
  }

  // ── Decline ────────────────────────────────────────────────────────────────────

  async declineBooking(bookingId: string): Promise<void> {
    const btn = this.declineBtn(bookingId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    const confirmBtn = this.page.getByRole('button', { name: /confirm|yes/i })
    if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
    await expect(this.page.getByText(/declined/i).first()).toBeVisible({ timeout: 10_000 })
  }

  // ── Start cleaning ─────────────────────────────────────────────────────────────

  async startCleaning(bookingId: string): Promise<void> {
    const btn = this.startBtn(bookingId)
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()
    await expect(this.page.locator('text=Cleaning in progress').first()).toBeVisible({ timeout: 15_000 })
  }

  // ── Assertions ─────────────────────────────────────────────────────────────────

  async assertOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/cleaner\/dashboard/)
  }

  async assertAwaitingApproval(): Promise<void> {
    await expect(
      this.page.getByText(/pending approval|under review|application/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  }

  // ── Earnings ───────────────────────────────────────────────────────────────────

  async earningsTotalVisible(): Promise<void> {
    await expect(this.page.getByText(/total earnings|lifetime/i).first()).toBeVisible({ timeout: 10_000 })
  }
}
