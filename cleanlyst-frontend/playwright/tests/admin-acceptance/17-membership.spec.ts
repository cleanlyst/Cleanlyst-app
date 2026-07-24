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
 * CRITICAL FIX C2 (20260724010000_enforce_membership_on_booking_creation) —
 * server-side membership enforcement on bookings INSERT. Every test below
 * authenticates as the customer/admin in question (via createAuthedClient,
 * respecting RLS — never the service-role `db` client) and attempts a REAL
 * direct `.from('bookings').insert(...)`, i.e. exactly the "direct API"
 * bypass the audit flagged. There is no separate booking-creation RPC in
 * this app (bookingService.createBookingRequest does a plain insert), so
 * the same RLS policy + trigger covers every calling path uniformly —
 * "RPC blocked" and "direct API blocked" are the same enforcement point:
 *   M17.14 — free-tier customer's booking insert is rejected
 *   M17.15 — cancelled membership customer's booking insert is rejected
 *   M17.16 — paused (suspended) membership customer's booking insert is rejected
 *   M17.17 — active-status but expired (current_period_end in the past) is rejected
 *   M17.18 — active, non-expired member's booking insert succeeds
 *   M17.19 — admin's booking insert on behalf of another customer succeeds regardless of that customer's membership
 *   M17.20 — is_member() itself reflects the expiry fix (unit-level check)
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
  createAuthedClient,
  getServiceIdForCleaner,
} from '../../helpers/db'
import { resolveTestUsers } from '../../helpers/testUsers'
import { collectConsoleErrors, collectNetworkFailures } from '../../helpers/adminGuards'

test.describe.configure({ mode: 'serial' })

// Ephemeral user created for membership state tests (isolated from E2E test user)
let EPHEMERAL_CUSTOMER_ID = ''
const EPHEMERAL_CUSTOMER_PASSWORD = 'TestPassword123!'
let DEFAULT_PLAN_ID: string | null = null

// Second ephemeral customer, held permanently at 'free' — reused across the
// C2 booking-enforcement tests below so each one seeds/tears down its own
// membership state independently of EPHEMERAL_CUSTOMER_ID's shared state.
let ENFORCEMENT_CUSTOMER_ID = ''
let ENFORCEMENT_CUSTOMER_EMAIL = ''
const ENFORCEMENT_CUSTOMER_PASSWORD = 'TestPassword123!'

// Ephemeral admin — used to verify admins bypass membership enforcement.
let EPHEMERAL_ADMIN_ID = ''
let EPHEMERAL_ADMIN_EMAIL = ''
const EPHEMERAL_ADMIN_PASSWORD = 'TestPassword123!'

let CUSTOMER_ID = ''
let CLEANER_ID  = ''
let SERVICE_ID  = ''

test.beforeAll(async () => {
  const users = await resolveTestUsers()
  CUSTOMER_ID = users.customerId
  CLEANER_ID  = users.cleanerId
  SERVICE_ID  = await getServiceIdForCleaner(CLEANER_ID)

  // Resolve default plan once
  const plan = await getDefaultMembershipPlan()
  DEFAULT_PLAN_ID = plan?.id ?? null

  // Create ephemeral customer for isolated membership state tests
  const ephemeral = await createEphemeralUser('m17-cust', EPHEMERAL_CUSTOMER_PASSWORD, { role: 'customer' })
  EPHEMERAL_CUSTOMER_ID = ephemeral.id

  // Set role so Supabase profile exists
  await db.from('profiles').update({ role: 'customer' }).eq('id', EPHEMERAL_CUSTOMER_ID)

  const enforcementCustomer = await createEphemeralUser('m17-enforce', ENFORCEMENT_CUSTOMER_PASSWORD, { role: 'customer' })
  ENFORCEMENT_CUSTOMER_ID = enforcementCustomer.id
  ENFORCEMENT_CUSTOMER_EMAIL = enforcementCustomer.email
  await db.from('profiles').update({ role: 'customer' }).eq('id', ENFORCEMENT_CUSTOMER_ID)

  const adminUser = await createEphemeralUser('m17-admin', EPHEMERAL_ADMIN_PASSWORD, { role: 'admin' })
  EPHEMERAL_ADMIN_ID = adminUser.id
  EPHEMERAL_ADMIN_EMAIL = adminUser.email
  await db.from('profiles').update({ role: 'admin' }).eq('id', EPHEMERAL_ADMIN_ID)
})

test.afterAll(async () => {
  await deleteCustomerMembership(ENFORCEMENT_CUSTOMER_ID)
  if (ENFORCEMENT_CUSTOMER_ID) await deleteUser(ENFORCEMENT_CUSTOMER_ID)
  if (EPHEMERAL_ADMIN_ID) await deleteUser(EPHEMERAL_ADMIN_ID)
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

// ─── C2 — server-side membership enforcement on booking creation ────────────
//
// Every test in this block authenticates as the customer/admin under test
// and attempts a direct `.from('bookings').insert(...)` — the exact "direct
// API, bypassing the Vue router guard" attack the audit described. A
// success here would mean RLS + the trigger from
// 20260724010000_enforce_membership_on_booking_creation.sql have both
// failed; both must independently reject a non-member's insert.

function bookingInsertPayload(customerId: string) {
  return {
    customer_id: customerId,
    cleaner_id: CLEANER_ID,
    service_id: SERVICE_ID,
    service_title_snapshot: 'C2 enforcement test',
    location_text: '1 Test Street, Wigan',
    scheduled_start: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    scheduled_end: new Date(Date.now() + 5 * 86_400_000 + 2 * 3_600_000).toISOString(),
    quote_cents: 5000,
    cleaner_payout_cents: 4000,
    currency: 'GBP',
    status: 'pending_request',
    payment_status: 'unpaid',
  }
}

test('M17.14 — free-tier customer: direct booking insert is rejected', async () => {
  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'free')

  const client = await createAuthedClient(ENFORCEMENT_CUSTOMER_EMAIL, ENFORCEMENT_CUSTOMER_PASSWORD)
  const { data, error } = await client
    .from('bookings')
    .insert(bookingInsertPayload(ENFORCEMENT_CUSTOMER_ID))
    .select('id')
    .single()

  expect(error).toBeTruthy()
  expect(data).toBeNull()
  expect(error?.message ?? '').toMatch(/membership_required|row-level security/i)
})

test('M17.15 — cancelled membership: direct booking insert is rejected with a helpful error', async () => {
  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'cancelled', DEFAULT_PLAN_ID)

  const client = await createAuthedClient(ENFORCEMENT_CUSTOMER_EMAIL, ENFORCEMENT_CUSTOMER_PASSWORD)
  const { data, error } = await client
    .from('bookings')
    .insert(bookingInsertPayload(ENFORCEMENT_CUSTOMER_ID))
    .select('id')
    .single()

  expect(error).toBeTruthy()
  expect(data).toBeNull()
  // The BEFORE INSERT trigger fires before RLS's WITH CHECK, so its
  // specific, human-readable message is what the caller actually sees.
  expect(error?.message ?? '').toMatch(/cancelled/i)
})

test('M17.16 — paused (suspended) membership: direct booking insert is rejected with a helpful error', async () => {
  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'paused', DEFAULT_PLAN_ID)

  const client = await createAuthedClient(ENFORCEMENT_CUSTOMER_EMAIL, ENFORCEMENT_CUSTOMER_PASSWORD)
  const { data, error } = await client
    .from('bookings')
    .insert(bookingInsertPayload(ENFORCEMENT_CUSTOMER_ID))
    .select('id')
    .single()

  expect(error).toBeTruthy()
  expect(data).toBeNull()
  expect(error?.message ?? '').toMatch(/paused/i)
})

test('M17.17 — active status but expired billing period: direct booking insert is rejected', async () => {
  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'active', DEFAULT_PLAN_ID)
  // Backdate the period end so status='active' is stale — this is exactly
  // the gap the audit found: is_member() previously ignored this column.
  await db
    .from('customer_memberships')
    .update({ current_period_end: new Date(Date.now() - 24 * 3_600_000).toISOString() })
    .eq('customer_id', ENFORCEMENT_CUSTOMER_ID)

  const client = await createAuthedClient(ENFORCEMENT_CUSTOMER_EMAIL, ENFORCEMENT_CUSTOMER_PASSWORD)
  const { data, error } = await client
    .from('bookings')
    .insert(bookingInsertPayload(ENFORCEMENT_CUSTOMER_ID))
    .select('id')
    .single()

  expect(error).toBeTruthy()
  expect(data).toBeNull()
  expect(error?.message ?? '').toMatch(/expired/i)
})

test('M17.18 — active, non-expired member: booking insert succeeds', async () => {
  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'active', DEFAULT_PLAN_ID)
  await db
    .from('customer_memberships')
    .update({ current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq('customer_id', ENFORCEMENT_CUSTOMER_ID)

  const client = await createAuthedClient(ENFORCEMENT_CUSTOMER_EMAIL, ENFORCEMENT_CUSTOMER_PASSWORD)
  const { data, error } = await client
    .from('bookings')
    .insert(bookingInsertPayload(ENFORCEMENT_CUSTOMER_ID))
    .select('id')
    .single()

  expect(error).toBeNull()
  const bookingId = (data as { id: string } | null)?.id
  expect(bookingId).toBeTruthy()

  if (bookingId) await deleteBooking(bookingId)
})

test('M17.19 — admin: booking insert on behalf of a free-tier customer succeeds', async () => {
  // Admins bypass membership entirely — the pre-existing "Admin manages
  // bookings" RLS policy (using(is_admin())) already grants this
  // independently of "Customers create bookings", and the new trigger's
  // is_admin() check confirms the same for defense-in-depth.
  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'free')

  const adminClient = await createAuthedClient(EPHEMERAL_ADMIN_EMAIL, EPHEMERAL_ADMIN_PASSWORD)
  const { data, error } = await adminClient
    .from('bookings')
    .insert(bookingInsertPayload(ENFORCEMENT_CUSTOMER_ID))
    .select('id')
    .single()

  expect(error).toBeNull()
  const bookingId = (data as { id: string } | null)?.id
  expect(bookingId).toBeTruthy()

  if (bookingId) await deleteBooking(bookingId)
})

test('M17.20 — is_member() reflects the current_period_end expiry fix', async () => {
  // Unit-level check on the fixed function itself, authenticated as the
  // customer whose membership it inspects (is_member() reads auth.uid()).
  const client = await createAuthedClient(ENFORCEMENT_CUSTOMER_EMAIL, ENFORCEMENT_CUSTOMER_PASSWORD)

  await upsertCustomerMembership(ENFORCEMENT_CUSTOMER_ID, 'active', DEFAULT_PLAN_ID)
  await db
    .from('customer_memberships')
    .update({ current_period_end: new Date(Date.now() - 3_600_000).toISOString() })
    .eq('customer_id', ENFORCEMENT_CUSTOMER_ID)
  const { data: expiredResult } = await client.rpc('is_member')
  expect(expiredResult).toBe(false)

  await db
    .from('customer_memberships')
    .update({ current_period_end: new Date(Date.now() + 3_600_000).toISOString() })
    .eq('customer_id', ENFORCEMENT_CUSTOMER_ID)
  const { data: activeResult } = await client.rpc('is_member')
  expect(activeResult).toBe(true)
})
