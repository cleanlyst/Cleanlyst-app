import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class CustomerDashboard {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/customer/dashboard')
    await this.page.waitForLoadState('networkidle')
  }

  async gotoBookings() {
    await this.page.goto('/customer/dashboard/bookings')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  get newBookingBtn() { return this.page.getByRole('link', { name: /new booking|book a cleaner/i }).or(this.page.getByRole('button', { name: /new booking|book/i })).first() }
  get myBookingsLink(){ return this.page.getByRole('link', { name: /my bookings|bookings/i }) }
  get profileLink()  { return this.page.getByRole('link', { name: /profile|account/i }) }
  get logoutBtn()    { return this.page.getByRole('button', { name: /log out|sign out/i }) }

  // ── Booking tabs ─────────────────────────────────────────────────────────────

  async switchTab(name: 'Pending' | 'Active' | 'Completed' | 'Cancelled'): Promise<void> {
    await this.page.getByRole('button', { name }).click()
    await this.page.waitForLoadState('networkidle')
  }

  // ── Assertions ────────────────────────────────────────────────────────────────

  async assertOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/customer\/dashboard/)
    await expect(this.page.getByText(/my bookings|dashboard/i).first()).toBeVisible()
  }

  async assertBookingVisible(bookingId: string): Promise<void> {
    const row = this.page.locator(`[data-booking-id="${bookingId}"]`).or(this.page.getByText(bookingId.slice(0, 8)))
    await expect(row.first()).toBeVisible({ timeout: 10_000 })
  }

  async firstBookingCard() {
    return this.page.locator('[data-testid="booking-card"]').or(this.page.locator('[class*="booking-card"]')).first()
  }

  async clickFirstBooking(): Promise<string> {
    const card = await this.firstBookingCard()
    await card.click()
    const url = this.page.url()
    return url.split('/').pop() ?? ''
  }

  // ── Notifications ─────────────────────────────────────────────────────────────

  get notificationBell() { return this.page.getByTestId('notification-bell').or(this.page.getByRole('button', { name: /notifications/i })) }
  get notificationPanel(){ return this.page.getByTestId('notification-panel').or(this.page.locator('[class*="notification-panel"]')) }
}
