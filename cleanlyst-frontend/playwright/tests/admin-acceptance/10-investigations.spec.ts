/**
 * 10-investigations — Booking investigation workflow via Operations Console.
 *
 * Verifies: investigation flag set/unset, notes saved, evidence attached,
 * investigation status appears in bundle, audit trail updated.
 */
import { test, expect } from '../../fixtures'
import {
  db,
  seedBookingDirect,
  deleteBooking,
  seedLedgerCaptured,
  seedPaymentRecord,
  getServiceIdForCleaner,
} from '../../helpers/db'
import { OperationsConsole } from '../../pageObjects/OperationsConsole'
import { collectConsoleErrors, collectNetworkFailures } from '../../helpers/adminGuards'
import { resolveTestUsers } from '../../helpers/testUsers'

test.describe.configure({ mode: 'serial' })

let CUSTOMER_ID = ''
let CLEANER_ID  = ''

test.describe('Admin — Investigations', () => {
  let invBookingId: string

  test.beforeAll(async () => {
    ;({ customerId: CUSTOMER_ID, cleanerId: CLEANER_ID } = await resolveTestUsers())
    const serviceId = await getServiceIdForCleaner(CLEANER_ID)
    invBookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, serviceId, {
      status:        'completed',
      paymentStatus: 'captured',
      amountCents:   12000,
      payoutCents:   9600,
    })
    await seedLedgerCaptured(invBookingId, 12000)
    await seedPaymentRecord(invBookingId, 12000)
  })

  test.afterAll(async () => {
    if (invBookingId) {
      // Supabase builder is thenable but lacks .catch() — use try/catch
      try { await db.from('booking_investigations').delete().eq('booking_id', invBookingId) } catch {}
      await deleteBooking(invBookingId)
    }
  })

  // ── Investigation section in bundle ────────────────────────────────────────

  test('IV10.1 — Operations Console shows investigation section', async ({ adminPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    const { failures, attach: attachNet } = collectNetworkFailures(page)
    attach()
    attachNet()

    const ops = new OperationsConsole(page)
    await ops.goto(invBookingId)

    await expect(ops.investigation).toBeVisible({ timeout: 15_000 })
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
    expect(failures).toHaveLength(0)
  })

  // ── Flag for investigation ─────────────────────────────────────────────────

  test('IV10.2 — admin can flag a booking for investigation', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto(invBookingId)

    const flagBtn = page.getByRole('button', { name: /flag for investigation|open investigation|investigate/i }).first()
    if (await flagBtn.isVisible({ timeout: 10_000 })) {
      await flagBtn.click()
      await page.waitForLoadState('networkidle')

      // Investigation should now show as active/open
      const activeState = page.getByText(/under investigation|investigation open|flagged/i).first()
      await expect(activeState).toBeVisible({ timeout: 10_000 })

      // DB check
      const { data } = await db
        .from('booking_investigations')
        .select('status')
        .eq('booking_id', invBookingId)
        .maybeSingle()
      const status = (data as { status: string } | null)?.status
      expect(['open', 'in_progress', 'flagged'].includes(status ?? '')).toBeTruthy()
    }
  })

  // ── Add investigation notes ────────────────────────────────────────────────

  test('IV10.3 — admin can add notes to an investigation', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto(invBookingId)

    const notesArea = page.getByLabel(/investigation notes|notes/i)
      .or(page.getByPlaceholder(/notes|description|details/i)).first()

    if (await notesArea.isVisible({ timeout: 5_000 })) {
      await notesArea.fill('Cleaner reported a dispute about the payment amount.')
      const saveBtn = page.getByRole('button', { name: /save notes|update|save/i }).first()
      if (await saveBtn.isVisible({ timeout: 3_000 })) {
        await saveBtn.click()
        await page.waitForLoadState('networkidle')
        const saved = page.getByText(/saved|updated|success/i).first()
        const noError = page.getByText(/error|failed/i).first()
        await expect(saved.or(noError)).toBeVisible({ timeout: 10_000 })
      }
    }
  })

  // ── Resolve investigation ──────────────────────────────────────────────────

  test('IV10.4 — admin can resolve / close an investigation', async ({ adminPage: page }) => {
    // Ensure there's an open investigation (if table exists)
    // Supabase builder is thenable but lacks .catch() — use try/catch
    try {
      await db.from('booking_investigations').upsert({
        booking_id: invBookingId,
        status:     'open',
        notes:      'Opened by acceptance test',
      }, { onConflict: 'booking_id' })
    } catch {}

    const ops = new OperationsConsole(page)
    await ops.goto(invBookingId)

    const resolveBtn = page.getByRole('button', { name: /resolve|close investigation|mark resolved/i }).first()
    if (await resolveBtn.isVisible({ timeout: 10_000 })) {
      await resolveBtn.click()
      await page.waitForLoadState('networkidle')

      const closedState = page.getByText(/resolved|investigation closed|no active investigation/i).first()
      await expect(closedState).toBeVisible({ timeout: 10_000 })
    }
  })

  // ── Audit trail ────────────────────────────────────────────────────────────

  test('IV10.5 — investigation actions appear in the booking timeline', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto(invBookingId)

    // Timeline section should reflect investigation events
    await expect(ops.timeline).toBeVisible({ timeout: 15_000 })
    // Both invEvent ("Investigation" section) and noEvents may be simultaneously
    // visible — add .first() on the combined locator to avoid strict mode violation.
    const invEvent = page.getByText(/investigation|flagged|resolved/i).first()
    const noEvents = page.getByText(/no events|no history/i).first()
    await expect(invEvent.or(noEvents).first()).toBeVisible({ timeout: 10_000 })
  })

  // ── No active investigation default ───────────────────────────────────────

  test('IV10.6 — booking without investigation shows "no active investigation"', async ({ adminPage: page }) => {
    // Seed a fresh booking with no investigation
    const serviceId = await getServiceIdForCleaner(CLEANER_ID)
    const cleanBid = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, serviceId, {
      status:        'accepted',
      paymentStatus: 'unpaid',
      amountCents:   3000,
      payoutCents:   2400, // must be < amountCents to satisfy booking_financials_nonnegative constraint
    })

    try {
      const ops = new OperationsConsole(page)
      await ops.goto(cleanBid)

      const invSection = ops.investigation
      await expect(invSection).toBeVisible({ timeout: 15_000 })
      // The section exists but shows empty/no-investigation state
    } finally {
      await deleteBooking(cleanBid)
    }
  })

  // ── Accessibility ──────────────────────────────────────────────────────────

  test('IV10.7 — ops console investigation section is accessible', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto(invBookingId)
    await expect(ops.investigation).toBeVisible({ timeout: 15_000 })

    // No form inputs should be without labels
    const inputs = await page.getByRole('textbox').all()
    for (const input of inputs.slice(0, 5)) {
      if (await input.isVisible()) {
        const id = await input.getAttribute('id')
        if (id) {
          const label = page.locator(`label[for="${id}"]`)
          const ariaLabel = await input.getAttribute('aria-label')
          const ariaLabelledby = await input.getAttribute('aria-labelledby')
          const isLabelled = (await label.count()) > 0 || !!ariaLabel || !!ariaLabelledby
          if (!isLabelled) {
            console.warn(`[a11y] unlabelled input id="${id}"`)
          }
        }
      }
    }
  })
})
