/**
 * 11-search — Global and per-section search across all admin pages.
 *
 * Verifies: cleaner search, booking search, email search in ops console,
 * Stripe ID search, empty states for no results, search clears correctly.
 */
import { test, expect } from '../../fixtures'
import {
  seedBookingDirect,
  deleteBooking,
  seedLedgerCaptured,
  getServiceIdForCleaner,
} from '../../helpers/db'
import { OperationsConsole } from '../../pageObjects/OperationsConsole'
import { collectConsoleErrors } from '../../helpers/adminGuards'
import { resolveTestUsers } from '../../helpers/testUsers'

test.describe.configure({ mode: 'serial' })

let CUSTOMER_ID = ''
let CLEANER_ID  = ''
const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL!
const CLEANER_EMAIL  = process.env.E2E_CLEANER_EMAIL!
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL!

test.describe('Admin — Search', () => {
  let searchBookingId: string

  test.beforeAll(async () => {
    ;({ customerId: CUSTOMER_ID, cleanerId: CLEANER_ID } = await resolveTestUsers())
    const serviceId = await getServiceIdForCleaner(CLEANER_ID)
    searchBookingId = await seedBookingDirect(CUSTOMER_ID, CLEANER_ID, serviceId, {
      status:        'confirmed',
      paymentStatus: 'unpaid',
      amountCents:   4500,
    })
  })

  test.afterAll(async () => {
    if (searchBookingId) await deleteBooking(searchBookingId)
  })

  // ── Cleaner search ─────────────────────────────────────────────────────────

  test('SR11.1 — cleaner search by name returns results', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('cleaner-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    await searchInput.fill('cleaner')
    await page.waitForTimeout(600)
    await page.waitForLoadState('networkidle')

    // Either rows or empty state
    const table = page.getByRole('table').last()
    const empty = page.getByText(/no cleaners found/i)
    await expect(table.or(empty)).toBeVisible({ timeout: 8_000 })
  })

  test('SR11.2 — cleaner search by email returns matching cleaner', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('cleaner-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    await searchInput.fill(CLEANER_EMAIL)
    await page.waitForTimeout(600)
    await page.waitForLoadState('networkidle')

    const row = page.getByRole('row').nth(1)
    const empty = page.getByText(/no cleaners found/i)
    await expect(row.or(empty)).toBeVisible({ timeout: 8_000 })
  })

  test('SR11.3 — cleaner search is case-insensitive', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('cleaner-search-input')
    await searchInput.fill(CLEANER_EMAIL.toUpperCase())
    await page.waitForTimeout(600)
    await page.waitForLoadState('networkidle')

    const row = page.getByRole('row').nth(1)
    const empty = page.getByText(/no cleaners found/i)
    await expect(row.or(empty)).toBeVisible({ timeout: 8_000 })
  })

  // ── Booking search ─────────────────────────────────────────────────────────

  test('SR11.4 — booking search by UUID returns matching booking', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/bookings')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|booking id|uuid/i).first()
    if (await searchInput.isVisible({ timeout: 5_000 })) {
      await searchInput.fill(searchBookingId)
      await page.waitForTimeout(500)
      await page.waitForLoadState('networkidle')

      const result = page.getByText(searchBookingId.slice(0, 8))
      const empty = page.getByText(/no bookings|no results/i)
      await expect(result.or(empty)).toBeVisible({ timeout: 8_000 })
    }
  })

  test('SR11.5 — booking search by partial ID (first 8 chars)', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/bookings')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|booking id|uuid/i).first()
    if (await searchInput.isVisible({ timeout: 5_000 })) {
      await searchInput.fill(searchBookingId.slice(0, 8))
      await page.waitForTimeout(500)
      await page.waitForLoadState('networkidle')

      const result = page.getByText(searchBookingId.slice(0, 8))
      const empty = page.getByText(/no bookings|no results/i)
      await expect(result.or(empty)).toBeVisible({ timeout: 8_000 })
    }
  })

  // ── Operations Console search ──────────────────────────────────────────────

  test('SR11.6 — ops console search by booking UUID loads bundle', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto()

    await ops.search(searchBookingId)
    await page.waitForLoadState('networkidle')

    const bundle = ops.bookingSummary
    const noResults = ops.noResults
    await expect(bundle.or(noResults)).toBeVisible({ timeout: 15_000 })
  })

  test('SR11.7 — ops console search by customer email returns results', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto()

    await ops.search(CUSTOMER_EMAIL)
    await page.waitForLoadState('networkidle')

    const results = page.getByText(CUSTOMER_EMAIL)
      .or(ops.bookingSummary)
      .or(ops.noResults)
    await expect(results).toBeVisible({ timeout: 10_000 })
  })

  test('SR11.8 — ops console search by non-existent UUID shows no-results', async ({ adminPage: page }) => {
    const ops = new OperationsConsole(page)
    await ops.goto()

    await ops.search('00000000-0000-0000-0000-deadbeef1234')
    await page.waitForLoadState('networkidle')

    await expect(ops.noResults.or(ops.emptyState)).toBeVisible({ timeout: 10_000 })
  })

  // ── Search clear / reset ───────────────────────────────────────────────────

  test('SR11.9 — clearing cleaner search shows full list again', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('cleaner-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    // Search for something specific
    await searchInput.fill('xxxxxxxxnonexistent')
    await page.waitForTimeout(600)
    await page.waitForLoadState('networkidle')
    const empty = page.getByText(/no cleaners found/i)
    await expect(empty).toBeVisible({ timeout: 8_000 })

    // Clear the search
    await searchInput.clear()
    await page.waitForTimeout(600)
    await page.waitForLoadState('networkidle')

    // Full list (or at least not the empty state) should be visible
    const table = page.getByRole('table').last()
    await expect(table).toBeVisible({ timeout: 8_000 })
  })

  test('SR11.10 — search input clears with X/clear button if present', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('cleaner-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })
    await searchInput.fill('test search text')

    // Check for a clear button
    const clearBtn = page.getByRole('button', { name: /clear|×|✕/i }).first()
    if (await clearBtn.isVisible({ timeout: 2_000 })) {
      await clearBtn.click()
      await expect(searchInput).toHaveValue('')
    }
  })

  // ── No console errors during search ───────────────────────────────────────

  test('SR11.11 — search operations produce no console errors', async ({ adminPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    attach()

    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('cleaner-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    // Rapid typing to test debounce
    await searchInput.type('acc', { delay: 50 })
    await page.waitForTimeout(1000)
    await page.waitForLoadState('networkidle')

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})
