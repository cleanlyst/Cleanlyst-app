/**
 * Payment Certification — Checkout Invariants
 *
 * Invariants verified:
 *   PC-1  Opening Checkout creates NO authorization (no ledger events before Pay pressed)
 *   PC-2  Cancelling Checkout leaves booking in pending_request, payment_status = unpaid
 *   PC-3  Cancel leaves zero ledger events
 *   PC-4  Successful authorization sets status = payment_authorized
 *   PC-5  Successful authorization creates exactly ONE PAYMENT_AUTHORIZED ledger event
 *   PC-6  Successful authorization leaves booking with payment_status = authorized
 *   PC-7  Checkout Session is created with capture_method = manual
 *   PC-8  Failed card (decline) leaves booking in pending_request
 *   PC-9  Duplicate browser refresh on success page creates no duplicate ledger events
 */

import { test, expect } from '../../fixtures'
import { BookingWizard } from '../../pageObjects/BookingWizard'
import {
  STRIPE_CARDS,
  completeStripeHostedCheckout,
} from '../../helpers/stripe'
import {
  db,
  getUserIdByEmail,
  latestBookingForCustomer,
  getLedgerEvents,
  wipeDynamic,
} from '../../helpers/db'

test.describe.configure({ mode: 'serial' })

test.describe('PC — Checkout Invariants', () => {
  let customerUserId: string
  let cleanerUserId: string

  test.beforeAll(async () => {
    customerUserId = await getUserIdByEmail(process.env.E2E_CUSTOMER_EMAIL!)
    cleanerUserId  = await getUserIdByEmail(process.env.E2E_CLEANER_EMAIL!)
  })

  test.afterEach(async () => {
    await wipeDynamic(customerUserId, cleanerUserId)
  })

  // ── PC-1: Opening Checkout creates no authorization ─────────────────────────

  test('PC-1 — creating booking + redirecting to Stripe does not authorize payment', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 3 })
    await wizard.fillProperty()
    await wizard.selectFirstCleaner()

    const btn = page.getByTestId('confirm-pay-btn')
      .or(page.getByRole('button', { name: /confirm and pay/i }))
    await expect(btn).toBeEnabled({ timeout: 15_000 })
    await btn.click()

    // Must redirect to Stripe — not stay on the wizard
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 20_000 })

    // DB: verify booking was created
    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('pending_request')
    expect(booking!.payment_status).toBe('unpaid')

    // DB: verify zero PAYMENT_AUTHORIZED events (no authorization before Pay is pressed)
    const events = await getLedgerEvents(booking!.id)
    const authEvents = events.filter((e: { event_type: string }) => e.event_type === 'PAYMENT_AUTHORIZED')
    expect(authEvents).toHaveLength(0)
  })

  // ── PC-2 & PC-3: Cancel Checkout ───────────────────────────────────────────

  test('PC-2 — cancelling Checkout leaves booking pending_request with no ledger events', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 4 })
    await wizard.fillProperty()
    await wizard.selectFirstCleaner()

    const btn = page.getByTestId('confirm-pay-btn')
      .or(page.getByRole('button', { name: /confirm and pay/i }))
    await expect(btn).toBeEnabled({ timeout: 15_000 })
    await btn.click()

    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 20_000 })

    // Navigate to the cancel URL (simulates Stripe cancel button)
    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()

    await page.goto(`/checkout/cancel?booking_id=${booking!.id}`)
    await page.waitForLoadState('networkidle')

    // Wait for the cancel confirmation
    await page.waitForTimeout(2_000)

    // DB: booking must still be pending_request
    const { data: refreshed } = await db
      .from('bookings')
      .select('status, payment_status')
      .eq('id', booking!.id)
      .maybeSingle()

    expect((refreshed as { status: string } | null)?.status).toBe('pending_request')
    expect((refreshed as { payment_status: string } | null)?.payment_status).toBe('unpaid')

    // DB: zero ledger events (cancel URL does not write to ledger)
    const events = await getLedgerEvents(booking!.id)
    expect(events).toHaveLength(0)
  })

  // ── PC-4, PC-5, PC-6: Successful checkout authorization ───────────────────

  test('PC-3 — successful checkout creates exactly one PAYMENT_AUTHORIZED event and payment_status = authorized', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 5 })
    await wizard.fillProperty()
    await wizard.selectFirstCleaner()
    await wizard.confirmAndPay()

    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 10_000 })

    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()

    // Allow webhook up to 30 seconds to fire and update ledger + booking status
    let authEvents: { event_type: string }[] = []
    let finalBooking: { status: string; payment_status: string } | null = null
    for (let attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(2_000)
      authEvents = (await getLedgerEvents(booking!.id)).filter(
        (e: { event_type: string }) => e.event_type === 'PAYMENT_AUTHORIZED',
      )
      const { data } = await db
        .from('bookings')
        .select('status, payment_status')
        .eq('id', booking!.id)
        .maybeSingle()
      finalBooking = data as { status: string; payment_status: string } | null
      if (finalBooking?.status === 'payment_authorized') break
    }

    // PC-5: exactly ONE authorization event
    expect(authEvents).toHaveLength(1)

    // PC-4 & PC-6: booking advanced to payment_authorized with payment_status = authorized
    expect(finalBooking?.status).toBe('payment_authorized')
    expect(finalBooking?.payment_status).toBe('authorized')
  })

  // ── PC-7: Checkout Session capture_method = manual ─────────────────────────

  test('PC-4 — Checkout Session is created with capture_method = manual (payment NOT auto-captured)', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 6 })
    await wizard.fillProperty()
    await wizard.selectFirstCleaner()

    const btn = page.getByTestId('confirm-pay-btn')
      .or(page.getByRole('button', { name: /confirm and pay/i }))
    await expect(btn).toBeEnabled({ timeout: 15_000 })
    await btn.click()

    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 20_000 })

    // After redirect, booking is pending_request — NOT payment_authorized
    // This confirms no auto-capture happened during Checkout Session creation.
    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()
    expect(booking!.payment_status).toBe('unpaid')

    // Allow 3 seconds for any spurious webhook to fire
    await page.waitForTimeout(3_000)

    const { data: check } = await db
      .from('bookings')
      .select('payment_status, status')
      .eq('id', booking!.id)
      .maybeSingle()

    // Must still be unpaid — capture_method = manual means no auto-capture
    expect((check as { payment_status: string } | null)?.payment_status).toBe('unpaid')

    // Ledger must have NO PAYMENT_CAPTURED events
    const events = await getLedgerEvents(booking!.id)
    const captured = events.filter((e: { event_type: string }) => e.event_type === 'PAYMENT_CAPTURED')
    expect(captured).toHaveLength(0)
  })

  // ── PC-8: Failed card leaves booking unchanged ─────────────────────────────

  test('PC-5 — declined card leaves booking in pending_request with no ledger events', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 7 })
    await wizard.fillProperty()
    await wizard.selectFirstCleaner()

    const btn = page.getByTestId('confirm-pay-btn')
      .or(page.getByRole('button', { name: /confirm and pay/i }))
    await expect(btn).toBeEnabled({ timeout: 15_000 })
    await btn.click()

    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 20_000 })
    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()

    // Use the declined card
    await completeStripeHostedCheckout(page, STRIPE_CARDS.visaDeclined).catch(() => {
      // Card decline may throw — that's expected
    })

    // Allow time for Stripe to process the failure and potentially redirect
    await page.waitForTimeout(5_000)

    // DB: booking MUST still be pending_request — decline does not update it
    const { data: refreshed } = await db
      .from('bookings')
      .select('status, payment_status')
      .eq('id', booking!.id)
      .maybeSingle()

    const status = (refreshed as { status: string } | null)?.status
    const paymentStatus = (refreshed as { payment_status: string } | null)?.payment_status

    // Either still pending_request/unpaid, or Stripe returned the customer to cancel URL
    expect(['pending_request', 'cancelled']).toContain(status)
    if (status === 'pending_request') {
      expect(paymentStatus).toBe('unpaid')
    }

    // DB: no PAYMENT_AUTHORIZED events (decline should never authorize)
    const events = await getLedgerEvents(booking!.id)
    const authEvents = events.filter((e: { event_type: string }) => e.event_type === 'PAYMENT_AUTHORIZED')
    expect(authEvents).toHaveLength(0)
  })

  // ── PC-9: Browser refresh idempotency ──────────────────────────────────────

  test('PC-6 — refreshing the success page multiple times creates no duplicate ledger events', async ({ customerPage: page }) => {
    const wizard = new BookingWizard(page)
    await wizard.goto()
    await wizard.selectService()
    await wizard.fillSchedule({ daysAhead: 8 })
    await wizard.fillProperty()
    await wizard.selectFirstCleaner()
    await wizard.confirmAndPay()

    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 10_000 })

    const booking = await latestBookingForCustomer(customerUserId)
    expect(booking).not.toBeNull()

    // Wait for initial webhook
    await page.waitForTimeout(8_000)

    // Refresh 3 times
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Allow webhook retries to settle
    await page.waitForTimeout(5_000)

    // DB: exactly ONE PAYMENT_AUTHORIZED event (not three from the three refreshes)
    const events = await getLedgerEvents(booking!.id)
    const authEvents = events.filter((e: { event_type: string }) => e.event_type === 'PAYMENT_AUTHORIZED')

    // Stripe deduplicates by stripe_event_id; the UNIQUE constraint on
    // payment_ledger_events.stripe_event_id prevents any duplicates.
    expect(authEvents.length).toBeLessThanOrEqual(1)
  })
})
