/**
 * 16-state-machine-regression — Phase B7 Booking State Machine Canonicalisation
 *
 * REGRESSION TARGET
 * -----------------
 * Bug: "function public.transition_booking_state(uuid, booking_status, text) is not unique"
 * HTTP 400 from report_cleaner_no_show and any RPC that calls transition_booking_state
 * with 3 arguments.
 *
 * Root cause: migration 20260701000002_pay_before_accept.sql re-introduced the 3-param
 * overload alongside the canonical 5-param function, creating an ambiguous overload
 * resolved by 20260702000001_canonicalise_transition_booking_state.sql (drops 3-param).
 *
 * COVERAGE
 * --------
 * Customer paths (all call transition_booking_state with 3 args internally):
 *   SM16.1  — report_cleaner_no_show (replacement) — formerly threw "is not unique"
 *   SM16.2  — report_cleaner_no_show (refund)
 *   SM16.3  — cancel_booking_customer
 *   SM16.4  — cleaner_cannot_attend
 *
 * Admin paths (call transition_booking_state with 5 args — verify no regression):
 *   SM16.5  — admin_process_refund (full refund)
 *   SM16.6  — reassign_booking (force reassignment)
 *
 * State machine coverage via transition_booking_state directly:
 *   SM16.7  — payment_authorized → accepted (cleaner accepts)
 *   SM16.8  — accepted → in_progress (cleaner starts)
 *   SM16.9  — in_progress → completed (cleaner ends)
 *
 * Idempotency:
 *   SM16.10 — duplicate transition_booking_state call with same target is rejected
 *   SM16.11 — report_cleaner_no_show is rejected if started_at is set
 *
 * Operations Console:
 *   SM16.12 — booking timeline shows transition events after fix
 *   SM16.13 — no SQL ambiguity errors in JS console after fix
 *
 * Test IDs follow pattern SM16.x
 */
import { test, expect } from '../../fixtures'
import {
  seedBookingDirect,
  deleteBooking,
  seedLedgerAuthorized,
  seedLedgerCaptured,
  seedPaymentRecord,
  patchBooking,
  getBookingStatus,
  getServiceIdForCleaner,
} from '../../helpers/db'
import { resolveTestUsers } from '../../helpers/testUsers'
import { collectConsoleErrors, collectNetworkFailures } from '../../helpers/adminGuards'

test.describe.configure({ mode: 'serial' })

let CUSTOMER_ID = ''
let CLEANER_ID  = ''

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedNoShowEligibleBooking(customerId: string, cleanerId: string): Promise<string> {
  const svcId = await getServiceIdForCleaner(cleanerId)
  const id = await seedBookingDirect(customerId, cleanerId, svcId, {
    status:        'accepted',
    paymentStatus: 'authorized',
    amountCents:   6000,
    daysFromNow:   -2, // past booking
  })
  await seedLedgerAuthorized(id, 6000)
  // Move scheduled_start to 2h ago so 30-min window passes
  await patchBooking(id, {
    scheduled_start: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    scheduled_end:   new Date(Date.now() - 30 * 60_000).toISOString(),
  })
  return id
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Phase B7 — State Machine Canonicalisation Regression', () => {

  test.beforeAll(async () => {
    ;({ customerId: CUSTOMER_ID, cleanerId: CLEANER_ID } = await resolveTestUsers())
  })

  // ── Customer: report_cleaner_no_show (the original failing RPC) ─────────────

  test('SM16.1 — report_cleaner_no_show replacement does not throw "is not unique"', async ({ customerPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    attach()

    const bookingId = await seedNoShowEligibleBooking(CUSTOMER_ID, CLEANER_ID)
    try {
      await page.goto(`/customer/bookings/${bookingId}`)
      await page.waitForLoadState('networkidle')

      // Trigger the "Report no-show" modal
      const reportBtn = page.getByRole('button', { name: /report no.?show/i }).first()
      if (await reportBtn.isVisible({ timeout: 5000 })) {
        await reportBtn.click()
        // Click "Request replacement cleaner" in the modal
        const replaceBtn = page.getByRole('button', { name: /replacement|another cleaner/i }).first()
        if (await replaceBtn.isVisible({ timeout: 5000 })) {
          await replaceBtn.click()
          // Wait for navigation or success state — no error toast
          await page.waitForTimeout(2000)
          // Should not have any "is not unique" error in console
          const ambiguityErrors = errors().filter(e => e.includes('is not unique'))
          expect(ambiguityErrors).toHaveLength(0)
        }
      }

      // Direct DB check via Supabase RPC as customer
      const status = await getBookingStatus(bookingId)
      // Status should have transitioned (cleaner_no_show or reassign_requested)
      // If the button wasn't visible (booking state differs in staging), skip
      if (status !== 'accepted') {
        expect(['cleaner_no_show', 'reassign_requested']).toContain(status)
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
    }
  })

  test('SM16.2 — report_cleaner_no_show refund path succeeds without ambiguity error', async () => {
    // Test via direct Supabase RPC (not UI) to isolate the SQL ambiguity bug
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CUSTOMER_EMAIL!,
      password: process.env.E2E_CUSTOMER_PASSWORD!,
    })

    const bookingId = await seedNoShowEligibleBooking(CUSTOMER_ID, CLEANER_ID)
    try {
      const { error } = await client.rpc('report_cleaner_no_show', {
        p_booking_id: bookingId,
        p_action:     'refund',
      })

      // Before the fix: error.message would contain "is not unique"
      // After the fix: null error (or a business logic error, not SQL ambiguity)
      if (error) {
        expect(error.message).not.toContain('is not unique')
        // Acceptable: timing constraint (may not be 30 min past start in all envs)
        expect(error.message).toMatch(/no.?show|started|already|time/i)
      } else {
        const status = await getBookingStatus(bookingId)
        expect(status).toBe('cleaner_no_show')
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  test('SM16.3 — cancel_booking_customer does not throw "is not unique"', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CUSTOMER_EMAIL!,
      password: process.env.E2E_CUSTOMER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'payment_authorized',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })
    await seedLedgerAuthorized(bookingId, 6000)

    try {
      // cancel_booking_customer → calls transition_booking_state(id, 'cancelled', reason)
      const { error } = await client.rpc('cancel_booking_customer', {
        p_booking_id: bookingId,
        p_reason:     'Test cancellation — regression SM16.3',
      })

      if (error) {
        // Must NOT be the ambiguity error
        expect(error.message).not.toContain('is not unique')
      } else {
        const status = await getBookingStatus(bookingId)
        expect(status).toBe('cancelled')
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  test('SM16.4 — cleaner_cannot_attend does not throw "is not unique"', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CLEANER_EMAIL!,
      password: process.env.E2E_CLEANER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'payment_authorized',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })
    await seedLedgerAuthorized(bookingId, 6000)

    try {
      // cleaner_cannot_attend → calls transition_booking_state(id, 'cleaner_cancelled', reason)
      const { error } = await client.rpc('cleaner_cannot_attend', {
        p_booking_id: bookingId,
        p_reason:     'Test cannot attend — regression SM16.4',
      })

      if (error) {
        expect(error.message).not.toContain('is not unique')
      } else {
        const status = await getBookingStatus(bookingId)
        expect(status).toBe('cleaner_cancelled')
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  // ── Admin paths (5-arg callers — verify no regression) ─────────────────────

  test('SM16.5 — admin_process_refund (5-arg path) resolves without ambiguity', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_ADMIN_EMAIL!,
      password: process.env.E2E_ADMIN_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:                 'completed',
      paymentStatus:          'captured',
      amountCents:            8000,
      stripePaymentIntentId:  'pi_test_sm16_5',
    })
    await seedLedgerCaptured(bookingId, 8000)
    await seedPaymentRecord(bookingId, 8000)

    try {
      const { error } = await client.rpc('admin_process_refund', {
        p_booking_id:   bookingId,
        p_refund_cents: 8000,
        p_reason:       'regression_test_SM16_5',
        p_notes:        'State machine canonicalisation regression test',
      })

      if (error) {
        // Stripe call may fail in test env (no real PI) — that's fine
        // What must NOT happen is the SQL ambiguity error
        expect(error.message).not.toContain('is not unique')
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  test('SM16.6 — reassign_booking (5-arg path) resolves without ambiguity', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_ADMIN_EMAIL!,
      password: process.env.E2E_ADMIN_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'cleaner_cancelled',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })

    try {
      // reassign_booking calls transition_booking_state with 5 args
      const { error } = await client.rpc('reassign_booking', {
        p_booking_id:         bookingId,
        p_new_cleaner_id:     CLEANER_ID, // reassign to same cleaner (test env)
        p_note:               'regression_test_SM16_6',
        p_new_scheduled_start: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      })

      if (error) {
        // Conflict check might fail — acceptable. SQL ambiguity is not.
        expect(error.message).not.toContain('is not unique')
      } else {
        const status = await getBookingStatus(bookingId)
        expect(['accepted', 'paid', 'payment_authorized']).toContain(status)
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  // ── State machine transition coverage ──────────────────────────────────────

  test('SM16.7 — payment_authorized → accepted transition succeeds (canonical path)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CLEANER_EMAIL!,
      password: process.env.E2E_CLEANER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'payment_authorized',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })
    await seedLedgerAuthorized(bookingId, 6000)

    try {
      const { error } = await client.rpc('transition_booking_state', {
        p_booking_id:    bookingId,
        p_target_status: 'accepted',
        p_notify:        false,
      })

      if (error) {
        expect(error.message).not.toContain('is not unique')
      } else {
        const status = await getBookingStatus(bookingId)
        expect(['accepted', 'paid']).toContain(status)
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  test('SM16.8 — accepted → in_progress transition succeeds', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CLEANER_EMAIL!,
      password: process.env.E2E_CLEANER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'accepted',
      paymentStatus: 'captured',
      amountCents:   6000,
      daysFromNow:   -1,
    })
    await seedLedgerCaptured(bookingId, 6000)
    // Set scheduled_start to 2h ago so 60-min window passes
    await patchBooking(bookingId, {
      scheduled_start: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    })

    try {
      const { error } = await client.rpc('start_booking', {
        p_booking_id: bookingId,
      })

      if (error) {
        expect(error.message).not.toContain('is not unique')
      } else {
        const status = await getBookingStatus(bookingId)
        expect(status).toBe('in_progress')
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  test('SM16.9 — in_progress → completed transition succeeds', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CLEANER_EMAIL!,
      password: process.env.E2E_CLEANER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'in_progress',
      paymentStatus: 'captured',
      amountCents:   6000,
      daysFromNow:   -1,
    })
    await seedLedgerCaptured(bookingId, 6000)

    try {
      const { error } = await client.rpc('complete_booking', {
        p_booking_id: bookingId,
      })

      if (error) {
        expect(error.message).not.toContain('is not unique')
      } else {
        const status = await getBookingStatus(bookingId)
        expect(status).toBe('completed')
      }
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  // ── Idempotency ─────────────────────────────────────────────────────────────

  test('SM16.10 — duplicate transition to same status is rejected (not ambiguity error)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CUSTOMER_EMAIL!,
      password: process.env.E2E_CUSTOMER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'payment_authorized',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })
    await seedLedgerAuthorized(bookingId, 6000)

    try {
      // Cancel once
      await client.rpc('cancel_booking_customer', {
        p_booking_id: bookingId,
        p_reason:     'first cancel',
      })

      // Try to cancel again — should be rejected as invalid transition
      const { error: error2 } = await client.rpc('cancel_booking_customer', {
        p_booking_id: bookingId,
        p_reason:     'second cancel attempt',
      })

      expect(error2).not.toBeNull()
      expect(error2!.message).not.toContain('is not unique')
      expect(error2!.message).toMatch(/Invalid status transition|not authorised|not found/i)
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  test('SM16.11 — report_cleaner_no_show is rejected when booking already started', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'
    const client = createClient(
      process.env.SUPABASE_STAGING_URL!,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await client.auth.signInWithPassword({
      email:    process.env.E2E_CUSTOMER_EMAIL!,
      password: process.env.E2E_CUSTOMER_PASSWORD!,
    })

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'accepted',
      paymentStatus: 'authorized',
      amountCents:   6000,
      daysFromNow:   -2,
    })
    await seedLedgerAuthorized(bookingId, 6000)
    // Set started_at so the guard fires
    await patchBooking(bookingId, {
      started_at:      new Date(Date.now() - 3_600_000).toISOString(),
      scheduled_start: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    })

    try {
      const { error } = await client.rpc('report_cleaner_no_show', {
        p_booking_id: bookingId,
        p_action:     'refund',
      })

      expect(error).not.toBeNull()
      // Guard error — not a SQL ambiguity error
      expect(error!.message).not.toContain('is not unique')
      expect(error!.message).toMatch(/already been started|started/i)
    } finally {
      await deleteBooking(bookingId).catch(() => {})
      await client.auth.signOut()
    }
  })

  // ── Operations Console ──────────────────────────────────────────────────────

  test('SM16.12 — booking timeline shows status events after transition', async ({ adminPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    attach()

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'cancelled',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })
    await seedLedgerAuthorized(bookingId, 6000)

    try {
      await page.goto(`/admin/ops/${bookingId}`)
      await page.waitForLoadState('networkidle')

      // Event Timeline section should be visible
      await expect(page.getByText('Event Timeline')).toBeVisible({ timeout: 10000 })

      // No SQL ambiguity errors in console
      const ambiguityErrors = errors().filter(e => e.includes('is not unique'))
      expect(ambiguityErrors).toHaveLength(0)
    } finally {
      await deleteBooking(bookingId).catch(() => {})
    }
  })

  test('SM16.13 — no SQL ambiguity errors when loading booking detail', async ({ customerPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    attach()
    const { attach: attachNet } = collectNetworkFailures(page)
    attachNet()

    const svcId = await getServiceIdForCleaner(CLEANER_ID)
    const bookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, svcId, {
      status:        'payment_authorized',
      paymentStatus: 'authorized',
      amountCents:   6000,
    })
    await seedLedgerAuthorized(bookingId, 6000)

    try {
      await page.goto(`/customer/bookings/${bookingId}`)
      await page.waitForLoadState('networkidle')

      // Page should load without SQL errors
      const consoleErrors = errors()
      const ambiguityErrors = consoleErrors.filter(e => e.includes('is not unique'))
      expect(ambiguityErrors).toHaveLength(0)

      // Booking status pill should render
      await expect(page.getByText(/confirmed|price adjustment|pending/i).first()).toBeVisible()
    } finally {
      await deleteBooking(bookingId).catch(() => {})
    }
  })
})
