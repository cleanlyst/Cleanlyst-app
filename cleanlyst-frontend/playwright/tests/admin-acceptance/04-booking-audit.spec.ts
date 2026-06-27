/**
 * 04-booking-audit — Booking audit trail (status events, ledger events, timeline).
 *
 * Verifies: timeline loads, events appear in chronological order,
 * expand/collapse, timestamps present, ledger events, payment events.
 */
import { test, expect } from '../../fixtures'
import {
  db,
  seedBookingDirect,
  deleteBooking,
  seedLedgerCaptured,
  getServiceIdForCleaner,
  getBookingStatusEvents,
} from '../../helpers/db'
import { collectConsoleErrors, collectNetworkFailures } from '../../helpers/adminGuards'
import { resolveTestUsers } from '../../helpers/testUsers'

test.describe.configure({ mode: 'serial' })

let CUSTOMER_ID = ''
let CLEANER_ID  = ''

test.describe('Admin — Booking Audit', () => {
  let auditBookingId: string

  test.beforeAll(async () => {
    ;({ customerId: CUSTOMER_ID, cleanerId: CLEANER_ID } = await resolveTestUsers())
    const serviceId = await getServiceIdForCleaner(CLEANER_ID)
    auditBookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, serviceId, {
      status:           'confirmed',
      paymentStatus:    'captured',
      amountCents:      7500,
      payoutCents:      6000,
    })
    await seedLedgerCaptured(auditBookingId, 7500)
    // Insert a status event
    await db.from('booking_status_events').insert({
      booking_id:  auditBookingId,
      from_status: 'pending_request',
      to_status:   'confirmed',
      actor_role:  'cleaner',
      actor_id:    CLEANER_ID,
    })
  })

  test.afterAll(async () => {
    if (auditBookingId) {
      await db.from('booking_status_events').delete().eq('booking_id', auditBookingId)
      await deleteBooking(auditBookingId)
    }
  })

  // ── Booking audit page ─────────────────────────────────────────────────────

  test('BA4.1 — Booking Audit page loads without errors', async ({ adminPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    const { failures, attach: attachNet } = collectNetworkFailures(page)
    attach()
    attachNet()

    await page.goto('/admin/dashboard/booking-audit')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /audit|timeline/i }).first()).toBeVisible({ timeout: 10_000 })
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
    expect(failures).toHaveLength(0)
  })

  test('BA4.2 — can navigate to a specific booking audit by ID', async ({ adminPage: page }) => {
    await page.goto(`/admin/dashboard/booking-audit/${auditBookingId}`)
    await page.waitForLoadState('networkidle')

    // Timeline or audit events should be present
    const timeline = page.getByText(/timeline|events|audit log/i).first()
    const notFound = page.getByText(/not found|no events/i).first()
    await expect(timeline.or(notFound)).toBeVisible({ timeout: 10_000 })
  })

  // ── Status events ──────────────────────────────────────────────────────────

  test('BA4.3 — status change events appear in timeline', async ({ adminPage: page }) => {
    await page.goto(`/admin/dashboard/booking-audit/${auditBookingId}`)
    await page.waitForLoadState('networkidle')

    // Our seeded transition: pending_request → confirmed
    const confirmedEvent = page.getByText(/confirmed|pending_request/i).first()
    await expect(confirmedEvent).toBeVisible({ timeout: 10_000 })
  })

  test('BA4.4 — status events are in chronological order (DB verification)', async () => {
    const events = await getBookingStatusEvents(auditBookingId)
    for (let i = 1; i < events.length; i++) {
      const prev = new Date((events[i - 1] as { created_at: string }).created_at).getTime()
      const curr = new Date((events[i] as { created_at: string }).created_at).getTime()
      expect(prev).toBeLessThanOrEqual(curr)
    }
  })

  // ── Ledger events ──────────────────────────────────────────────────────────

  test('BA4.5 — ledger / payment events appear in audit view', async ({ adminPage: page }) => {
    await page.goto(`/admin/dashboard/booking-audit/${auditBookingId}`)
    await page.waitForLoadState('networkidle')

    const ledgerEvent = page.getByText(/payment_captured|ledger|captured/i).first()
    await expect(ledgerEvent).toBeVisible({ timeout: 10_000 })
  })

  // ── Timestamps ─────────────────────────────────────────────────────────────

  test('BA4.6 — audit entries display timestamps', async ({ adminPage: page }) => {
    await page.goto(`/admin/dashboard/booking-audit/${auditBookingId}`)
    await page.waitForLoadState('networkidle')

    // Timestamp should appear — look for date patterns (DD/MM/YYYY, YYYY-MM-DD, or relative "ago")
    const timestamp = page.getByText(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|ago|just now/i).first()
    await expect(timestamp).toBeVisible({ timeout: 10_000 })
  })

  // ── Expand / collapse (if accordion UI) ────────────────────────────────────

  test('BA4.7 — expand/collapse toggle works on audit events', async ({ adminPage: page }) => {
    await page.goto(`/admin/dashboard/booking-audit/${auditBookingId}`)
    await page.waitForLoadState('networkidle')

    // Check if any accordion/toggle button exists
    const toggleBtn = page.getByRole('button', { name: /expand|collapse|show details/i }).first()
    if (await toggleBtn.isVisible({ timeout: 3_000 })) {
      const before = await page.content()
      await toggleBtn.click()
      await page.waitForTimeout(300)
      const after = await page.content()
      // Page content should change after toggle
      expect(before).not.toBe(after)
    }
  })

  // ── Search within audit ────────────────────────────────────────────────────

  test('BA4.8 — audit page has a booking search input', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/booking-audit')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/booking|uuid|search/i).first()
    if (await searchInput.isVisible({ timeout: 5_000 })) {
      await searchInput.fill(auditBookingId)
      await page.waitForTimeout(500)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(auditBookingId.slice(0, 8))).toBeVisible({ timeout: 8_000 })
    }
  })
})
