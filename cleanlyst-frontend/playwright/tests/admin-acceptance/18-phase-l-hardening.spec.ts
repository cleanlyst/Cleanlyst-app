/**
 * 18-phase-l-hardening — Phase L closed-beta-readiness fixes
 *
 * Regression coverage for the two gaps fixed in
 * 20260724020000_phase_l_hardening.sql. Both are DB/RPC-level tests (no
 * browser — fast, deterministic), following the same direct-client pattern
 * as 17-membership.spec.ts.
 *
 *   L18.1 — same customer, same cleaner, same slot, still-pending: second
 *           insert is rejected by bookings_no_duplicate_pending_request
 *   L18.2 — once the first booking's status leaves the guarded set
 *           (e.g. declined), a new identical-slot booking is allowed again
 *   L18.3 — a DIFFERENT customer can still request the same cleaner/slot
 *           while the first customer's request is still pending (confirms
 *           the fix didn't regress the pre-existing multi-customer
 *           concurrent-request behaviour)
 *   L18.4 — authenticated user can upload to their own avatars/{uid}/ folder
 *   L18.5 — authenticated user cannot upload into another user's folder
 *   L18.6 — unauthenticated (anon) client can read an avatar (public bucket read)
 */
import { test, expect } from '../../fixtures'
import {
  db,
  createEphemeralUser,
  deleteUser,
  deleteBooking,
  patchBooking,
  upsertCustomerMembership,
  deleteCustomerMembership,
  getDefaultMembershipPlan,
  createAuthedClient,
  createAnonClient,
  getServiceIdForCleaner,
} from '../../helpers/db'
import { resolveTestUsers } from '../../helpers/testUsers'

test.describe.configure({ mode: 'serial' })

let CLEANER_ID = ''
let SERVICE_ID = ''
let DEFAULT_PLAN_ID: string | null = null

let CUSTOMER_A_ID = ''
let CUSTOMER_A_EMAIL = ''
const CUSTOMER_A_PASSWORD = 'TestPassword123!'

let CUSTOMER_B_ID = ''
let CUSTOMER_B_EMAIL = ''
const CUSTOMER_B_PASSWORD = 'TestPassword123!'

test.beforeAll(async () => {
  const users = await resolveTestUsers()
  CLEANER_ID = users.cleanerId
  SERVICE_ID = await getServiceIdForCleaner(CLEANER_ID)

  const plan = await getDefaultMembershipPlan()
  DEFAULT_PLAN_ID = plan?.id ?? null

  const customerA = await createEphemeralUser('l18-cust-a', CUSTOMER_A_PASSWORD, { role: 'customer' })
  CUSTOMER_A_ID = customerA.id
  CUSTOMER_A_EMAIL = customerA.email
  await db.from('profiles').update({ role: 'customer' }).eq('id', CUSTOMER_A_ID)
  await upsertCustomerMembership(CUSTOMER_A_ID, 'active', DEFAULT_PLAN_ID)
  await db
    .from('customer_memberships')
    .update({ current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq('customer_id', CUSTOMER_A_ID)

  const customerB = await createEphemeralUser('l18-cust-b', CUSTOMER_B_PASSWORD, { role: 'customer' })
  CUSTOMER_B_ID = customerB.id
  CUSTOMER_B_EMAIL = customerB.email
  await db.from('profiles').update({ role: 'customer' }).eq('id', CUSTOMER_B_ID)
  await upsertCustomerMembership(CUSTOMER_B_ID, 'active', DEFAULT_PLAN_ID)
  await db
    .from('customer_memberships')
    .update({ current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq('customer_id', CUSTOMER_B_ID)
})

test.afterAll(async () => {
  await deleteCustomerMembership(CUSTOMER_A_ID)
  if (CUSTOMER_A_ID) await deleteUser(CUSTOMER_A_ID)
  await deleteCustomerMembership(CUSTOMER_B_ID)
  if (CUSTOMER_B_ID) await deleteUser(CUSTOMER_B_ID)
})

// ─── L18.1–L18.3 — duplicate pending-booking prevention ─────────────────────

function bookingInsertPayload(customerId: string, scheduledStart: Date) {
  const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 3_600_000)
  return {
    customer_id: customerId,
    cleaner_id: CLEANER_ID,
    service_id: SERVICE_ID,
    service_title_snapshot: 'L18 duplicate-booking test',
    location_text: '1 Test Street, Wigan',
    scheduled_start: scheduledStart.toISOString(),
    scheduled_end: scheduledEnd.toISOString(),
    quote_cents: 5000,
    cleaner_payout_cents: 4000,
    currency: 'GBP',
    status: 'pending_request',
    payment_status: 'unpaid',
  }
}

test('L18.1 — duplicate pending request for same customer/cleaner/slot is rejected', async () => {
  const slot = new Date(Date.now() + 6 * 86_400_000)
  const client = await createAuthedClient(CUSTOMER_A_EMAIL, CUSTOMER_A_PASSWORD)

  const first = await client
    .from('bookings')
    .insert(bookingInsertPayload(CUSTOMER_A_ID, slot))
    .select('id')
    .single()
  expect(first.error).toBeNull()
  const firstId = (first.data as { id: string } | null)?.id
  expect(firstId).toBeTruthy()

  // Same customer, cleaner, and slot again while the first is still pending —
  // e.g. a double-click or duplicate tab submission.
  const second = await client
    .from('bookings')
    .insert({ ...bookingInsertPayload(CUSTOMER_A_ID, slot), status: 'estimate_proposed' })
    .select('id')
    .single()
  expect(second.error).toBeTruthy()
  expect(second.data).toBeNull()
  expect(second.error?.message ?? '').toMatch(/duplicate key value|bookings_no_duplicate_pending_request/i)

  if (firstId) await deleteBooking(firstId)
})

test('L18.2 — once the first booking leaves the guarded status set, the same slot can be re-requested', async () => {
  const slot = new Date(Date.now() + 7 * 86_400_000)
  const client = await createAuthedClient(CUSTOMER_A_EMAIL, CUSTOMER_A_PASSWORD)

  const first = await client
    .from('bookings')
    .insert(bookingInsertPayload(CUSTOMER_A_ID, slot))
    .select('id')
    .single()
  expect(first.error).toBeNull()
  const firstId = (first.data as { id: string } | null)?.id
  expect(firstId).toBeTruthy()

  // Move the first request out of the guarded set (declined), same as a
  // cleaner declining a request in the real flow.
  await patchBooking(firstId!, { status: 'declined' })

  const second = await client
    .from('bookings')
    .insert(bookingInsertPayload(CUSTOMER_A_ID, slot))
    .select('id')
    .single()
  expect(second.error).toBeNull()
  const secondId = (second.data as { id: string } | null)?.id
  expect(secondId).toBeTruthy()

  if (firstId) await deleteBooking(firstId)
  if (secondId) await deleteBooking(secondId)
})

test('L18.3 — a different customer can still request the same cleaner/slot while the first is pending', async () => {
  const slot = new Date(Date.now() + 8 * 86_400_000)
  const clientA = await createAuthedClient(CUSTOMER_A_EMAIL, CUSTOMER_A_PASSWORD)
  const clientB = await createAuthedClient(CUSTOMER_B_EMAIL, CUSTOMER_B_PASSWORD)

  const first = await clientA
    .from('bookings')
    .insert(bookingInsertPayload(CUSTOMER_A_ID, slot))
    .select('id')
    .single()
  expect(first.error).toBeNull()
  const firstId = (first.data as { id: string } | null)?.id

  const second = await clientB
    .from('bookings')
    .insert(bookingInsertPayload(CUSTOMER_B_ID, slot))
    .select('id')
    .single()
  expect(second.error).toBeNull()
  const secondId = (second.data as { id: string } | null)?.id
  expect(secondId).toBeTruthy()

  if (firstId) await deleteBooking(firstId)
  if (secondId) await deleteBooking(secondId)
})

// ─── L18.4–L18.6 — avatars storage bucket RLS ────────────────────────────────

const AVATAR_BYTES = Buffer.from('phase-l-test-avatar')

test('L18.4 — authenticated user can upload to their own avatars folder', async () => {
  const client = await createAuthedClient(CUSTOMER_A_EMAIL, CUSTOMER_A_PASSWORD)
  const path = `${CUSTOMER_A_ID}/avatar.png`

  const { error } = await client.storage.from('avatars').upload(path, AVATAR_BYTES, {
    contentType: 'image/png',
    upsert: true,
  })
  expect(error).toBeNull()

  await db.storage.from('avatars').remove([path])
})

test('L18.5 — authenticated user cannot upload into another user\'s avatars folder', async () => {
  const client = await createAuthedClient(CUSTOMER_A_EMAIL, CUSTOMER_A_PASSWORD)
  const path = `${CUSTOMER_B_ID}/avatar.png`

  const { error } = await client.storage.from('avatars').upload(path, AVATAR_BYTES, {
    contentType: 'image/png',
    upsert: true,
  })
  expect(error).toBeTruthy()

  await db.storage.from('avatars').remove([path])
})

test('L18.6 — unauthenticated client can read an uploaded avatar', async () => {
  const path = `${CUSTOMER_A_ID}/avatar.png`
  const { error: uploadError } = await db.storage.from('avatars').upload(path, AVATAR_BYTES, {
    contentType: 'image/png',
    upsert: true,
  })
  expect(uploadError).toBeNull()

  const anon = createAnonClient()
  const { data, error } = await anon.storage.from('avatars').download(path)
  expect(error).toBeNull()
  expect(data).toBeTruthy()

  await db.storage.from('avatars').remove([path])
})
