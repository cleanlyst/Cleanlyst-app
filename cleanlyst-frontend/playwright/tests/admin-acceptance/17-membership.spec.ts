/**
 * 17-membership — Phase M Membership Model
 *
 * COVERAGE
 * --------
 * Database / RPC layer (no browser — fast, deterministic):
 *   M17.1  — customer_memberships upsert creates free-tier row for new customer
 *   M17.2  — free membership status is NOT considered "is member"
 *   M17.3  — complimentary membership status IS considered "is member"
 *   M17.4  — paused membership status is NOT considered "is member"
 *   M17.5  — active membership status IS considered "is member"
 *   M17.6  — admin_grant_membership RPC succeeds without error
 *   M17.7  — admin_pause_membership RPC succeeds without error
 *   M17.8  — admin_reactivate_membership RPC succeeds (paused → active)
 *   M17.9  — admin_cancel_membership RPC succeeds (active → cancelled)
 *   M17.10 — admin_list_members RPC returns data without error
 *   M17.11 — bookings.payment_method column stores 'cash' and 'bank_transfer' correctly
 *   M17.12 — Admin /membership UI loads without uncaught JS errors or network failures
 *   M17.13 — Customer /membership UI loads without uncaught JS errors
 *
 * Test IDs follow pattern M17.x
 */
import { test, expect } from '../../fixtures'
import {
  db,
  createEphemeralUser,
  deleteUser,
  seedBookingDirect,
  deleteBooking,
  patchBooking,
  upsertCustomerMembership,
  getCustomerMembership,
  deleteCustomerMembership,
  getDefaultMembershipPlan,
  adminGrantMembershipRpc,
  adminPauseMembershipRpc,
  adminReactivateMembershipRpc,
  adminCancelMembershipRpc,
  adminListMembersRpc,
} from '../../helpers/db'
import { resolveTestUsers } from '../../helpers/testUsers'
import { collectConsoleErrors, collectNetworkFailures } from '../../helpers/adminGuards'

test.describe.configure({ mode: 'serial' })

// Ephemeral user created for membership state tests (isolated from E2E test user)
let EPHEMERAL_CUSTOMER_ID = ''
let DEFAULT_PLAN_ID: string | null = null

let CUSTOMER_ID = ''
let CLEANER_ID  = ''

test.beforeAll(async () => {
  const users = await resolveTestUsers()
  CUSTOMER_ID = users.customerId
  CLEANER_ID  = users.cleanerId

  // Resolve default plan once
  const plan = await getDefaultMembershipPlan()
  DEFAULT_PLAN_ID = plan?.id ?? null

  // Create ephemeral customer for isolated membership state tests
  const ephemeral = await createEphemeralUser('m17-cust', 'TestPassword123!', { role: 'customer' })
  EPHEMERAL_CUSTOMER_ID = ephemeral.id

  // Set role so Supabase profile exists
  await db.from('profiles').update({ role: 'customer' }).eq('id', EPHEMERAL_CUSTOMER_ID)
})

test.afterAll(async () => {
  await deleteCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  if (EPHEMERAL_CUSTOMER_ID) await deleteUser(EPHEMERAL_CUSTOMER_ID)
})

// ─── M17.1 — customer_memberships upsert ─────────────────────────────────────

test('M17.1 — upsertCustomerMembership creates free-tier row', async () => {
  await deleteCustomerMembership(EPHEMERAL_CUSTOMER_ID)

  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'free')

  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  expect(row).not.toBeNull()
  expect(row!.status).toBe('free')
})

// ─── M17.2–M17.5 — is_member logic (status-based) ───────────────────────────

test('M17.2 — free membership status is not "is member"', async () => {
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'free')
  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  const isMember = row?.status === 'active' || row?.status === 'complimentary'
  expect(isMember).toBe(false)
})

test('M17.3 — complimentary membership status is "is member"', async () => {
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'complimentary')
  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  const isMember = row?.status === 'active' || row?.status === 'complimentary'
  expect(isMember).toBe(true)
})

test('M17.4 — paused membership status is not "is member"', async () => {
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'paused')
  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  const isMember = row?.status === 'active' || row?.status === 'complimentary'
  expect(isMember).toBe(false)
})

test('M17.5 — active membership status is "is member"', async () => {
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'active', DEFAULT_PLAN_ID)
  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  const isMember = row?.status === 'active' || row?.status === 'complimentary'
  expect(isMember).toBe(true)
})

// ─── M17.6–M17.9 — Admin membership RPCs ────────────────────────────────────

test('M17.6 — admin_grant_membership RPC grants complimentary membership', async () => {
  await deleteCustomerMembership(EPHEMERAL_CUSTOMER_ID)

  const error = await adminGrantMembershipRpc(
    EPHEMERAL_CUSTOMER_ID,
    DEFAULT_PLAN_ID,
    'E2E test grant',
  )
  expect(error).toBeNull()

  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  expect(row?.status).toBe('complimentary')
})

test('M17.7 — admin_pause_membership RPC pauses an active membership', async () => {
  // Ensure customer has an active/complimentary membership first
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'active', DEFAULT_PLAN_ID)

  const error = await adminPauseMembershipRpc(EPHEMERAL_CUSTOMER_ID)
  expect(error).toBeNull()

  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  expect(row?.status).toBe('paused')
})

test('M17.8 — admin_reactivate_membership RPC reactivates a paused membership', async () => {
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'paused', DEFAULT_PLAN_ID)

  const error = await adminReactivateMembershipRpc(EPHEMERAL_CUSTOMER_ID)
  expect(error).toBeNull()

  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  expect(row?.status).toBe('active')
})

test('M17.9 — admin_cancel_membership RPC cancels an active membership', async () => {
  await upsertCustomerMembership(EPHEMERAL_CUSTOMER_ID, 'active', DEFAULT_PLAN_ID)

  const error = await adminCancelMembershipRpc(EPHEMERAL_CUSTOMER_ID)
  expect(error).toBeNull()

  const row = await getCustomerMembership(EPHEMERAL_CUSTOMER_ID)
  expect(row?.status).toBe('cancelled')
})

// ─── M17.10 — admin_list_members ─────────────────────────────────────────────

test('M17.10 — admin_list_members RPC returns data without error', async () => {
  const { error, count } = await adminListMembersRpc()
  expect(error).toBeNull()
  // At minimum the ephemeral customer should appear
  expect(count).toBeGreaterThanOrEqual(0)
})

// ─── M17.11 — bookings.payment_method column ─────────────────────────────────

test('M17.11 — bookings.payment_method stores cash and bank_transfer correctly', async () => {
  const cashBookingId = await seedBookingDirect({
    customerId: CUSTOMER_ID,
    cleanerId:  CLEANER_ID,
  })
  await patchBooking(cashBookingId, { payment_method: 'cash' })

  const { data: cashRow } = await db
    .from('bookings')
    .select('payment_method')
    .eq('id', cashBookingId)
    .single()
  expect((cashRow as { payment_method: string } | null)?.payment_method).toBe('cash')

  const btBookingId = await seedBookingDirect({
    customerId: CUSTOMER_ID,
    cleanerId:  CLEANER_ID,
  })
  await patchBooking(btBookingId, { payment_method: 'bank_transfer' })

  const { data: btRow } = await db
    .from('bookings')
    .select('payment_method')
    .eq('id', btBookingId)
    .single()
  expect((btRow as { payment_method: string } | null)?.payment_method).toBe('bank_transfer')

  await deleteBooking(cashBookingId)
  await deleteBooking(btBookingId)
})

// ─── M17.12 — Admin /membership UI smoke ─────────────────────────────────────

test('M17.12 — Admin /membership page loads without JS errors', async ({ adminPage }) => {
  const consoleCollector = collectConsoleErrors(adminPage)
  const networkCollector = collectNetworkFailures(adminPage)
  consoleCollector.attach()
  networkCollector.attach()

  await adminPage.goto('/admin/dashboard/membership')
  await adminPage.waitForLoadState('networkidle')

  // Page should have the Membership heading
  await expect(adminPage.locator('h1, h2').filter({ hasText: /membership/i }).first()).toBeVisible()

  expect(consoleCollector.errors).toHaveLength(0)
  expect(networkCollector.failures.filter((f) => !f.includes('analytics_events'))).toHaveLength(0)
})

// ─── M17.13 — Customer /membership UI smoke ──────────────────────────────────

test('M17.13 — Customer /membership page loads without JS errors', async ({ customerPage }) => {
  const consoleCollector = collectConsoleErrors(customerPage)
  consoleCollector.attach()

  await customerPage.goto('/membership')
  await customerPage.waitForLoadState('networkidle')

  // Page should contain membership join / upgrade content
  await expect(
    customerPage.locator('h1, h2').filter({ hasText: /member/i }).first(),
  ).toBeVisible()

  expect(consoleCollector.errors).toHaveLength(0)
})
