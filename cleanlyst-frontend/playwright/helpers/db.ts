/**
 * db.ts — Service-role Supabase helpers for test setup and teardown.
 *
 * Re-exports the service client from the shared utils so all playwright tests
 * pull from one initialisation point. Only call these from beforeAll/afterAll
 * hooks — never inside a test assertion.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.playwright') })

const PRODUCTION_DOMAINS = ['cleanlyst.co.uk', 'www.cleanlyst.co.uk', 'cleanlyst.app']
const baseUrl  = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:5173'
const hostname = new URL(baseUrl).hostname
if (PRODUCTION_DOMAINS.includes(hostname)) {
  throw new Error(`playwright/helpers/db — refusing to run against production: ${baseUrl}`)
}

export const db: SupabaseClient = createClient(
  process.env.SUPABASE_STAGING_URL!,
  process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ─── User helpers ────────────────────────────────────────────────────────────

export interface TestUser {
  id: string
  email: string
  password: string
}

export async function createEphemeralUser(
  prefix: string,
  password = 'TestPassword123!',
  metadata: Record<string, string> = {},
): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}@test.cleanlyst.local`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: metadata.full_name ?? 'Test User', ...metadata },
  })
  if (error) throw error
  return { id: data.user!.id, email, password }
}

export async function deleteUser(userId: string): Promise<void> {
  await db.auth.admin.deleteUser(userId)
}

export async function getUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await db.auth.admin.listUsers({ query: email, page: 1, perPage: 100 })
  if (error) throw error
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No user with email ${email}`)
  return user.id
}

// ─── Booking helpers ─────────────────────────────────────────────────────────

export async function patchBooking(bookingId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('bookings').update(patch).eq('id', bookingId)
  if (error) throw error
}

export async function getBookingStatus(bookingId: string): Promise<string | null> {
  const { data, error } = await db.from('bookings').select('status').eq('id', bookingId).maybeSingle()
  if (error) throw error
  return (data as { status: string } | null)?.status ?? null
}

export async function latestBookingForCustomer(
  customerId: string,
): Promise<{ id: string; status: string; payment_status: string } | null> {
  const { data, error } = await db
    .from('bookings')
    .select('id, status, payment_status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; status: string; payment_status: string } | null
}

export async function wipeDynamic(customerId: string): Promise<void> {
  const { data: rows } = await db.from('bookings').select('id').eq('customer_id', customerId)
  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id)
  if (!ids.length) return
  // payment_ledger_events: FK is RESTRICT and the trigger blocks CASCADE deletes
  // (cascade runs as table owner 'postgres', not service_role). Direct service_role
  // delete works because the trigger bypass fires when current_user = 'service_role'.
  await db.from('payment_ledger_events').delete().in('booking_id', ids)
  // transactions = ON DELETE RESTRICT, reviews = NO ACTION — must delete explicitly
  await db.from('transactions').delete().in('booking_id', ids)
  await db.from('reviews').delete().in('booking_id', ids)
  // All remaining child tables (payments, payouts, booking_status_events,
  // notifications, messages) have ON DELETE CASCADE and no blocking triggers.
  await db.from('bookings').delete().eq('customer_id', customerId)
}

// ─── Authenticated client helper (uses anon key + user credentials) ───────────

const SUPABASE_ANON_KEY = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'

async function createAuthedClient(email: string, password: string) {
  const client = createClient(
    process.env.SUPABASE_STAGING_URL!,
    SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Auth sign-in failed for ${email}: ${error.message}`)
  return client
}

// ─── Booking status advancement (bypasses DB trigger via authenticated RPC) ───

// Seed a PAYMENT_CAPTURED ledger event so derive_payment_state_from_ledger()
// returns 'captured'. transition_booking_state (20260622400000) gates the
// accepted→paid auto-advance AND the in_progress guard on this ledger value —
// not on bookings.payment_status (which is only a denormalized cache).
export async function seedLedgerCaptured(bookingId: string, amountCents = 5000): Promise<void> {
  const { error } = await db.from('payment_ledger_events').upsert(
    {
      booking_id:      bookingId,
      event_type:      'PAYMENT_CAPTURED',
      amount_cents:    amountCents,
      stripe_event_id: `seed_cap_${bookingId}`,
      metadata:        {},
    },
    { onConflict: 'stripe_event_id', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function advanceBookingToPaid(bookingId: string): Promise<void> {
  // Seed the ledger so transition_booking_state sees v_payment_state = 'captured'.
  await seedLedgerCaptured(bookingId)

  const { data: row } = await db.from('bookings').select('status').eq('id', bookingId).maybeSingle()
  const currentStatus = (row as { status: string } | null)?.status

  if (currentStatus === 'paid') return

  const client = await createAuthedClient(
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  )
  try {
    if (currentStatus !== 'accepted') {
      // Transition from pending_request (or wherever) → accepted
      const { error: e1 } = await client.rpc('transition_booking_state', {
        p_booking_id:    bookingId,
        p_target_status: 'accepted',
        p_notify:        false,
      })
      if (e1) throw new Error(`advance to accepted failed: ${e1.message}`)

      // Auto-advance may have moved it to paid (if PAYMENT_CAPTURED was already in ledger)
      const { data: row2 } = await db.from('bookings').select('status').eq('id', bookingId).maybeSingle()
      if ((row2 as { status: string } | null)?.status === 'paid') return
    }

    // Transition accepted → paid explicitly
    const { error: e2 } = await client.rpc('transition_booking_state', {
      p_booking_id:    bookingId,
      p_target_status: 'paid',
      p_notify:        false,
    })
    if (e2) throw new Error(`advance to paid failed: ${e2.message}`)
  } finally {
    await client.auth.signOut()
  }
}

export async function advanceBookingToInProgress(bookingId: string): Promise<void> {
  // Move scheduled_start to the past so the 60-min window check passes (non-guarded field)
  await db.from('bookings').update({
    scheduled_start: new Date(Date.now() - 120 * 60_000).toISOString(),
  }).eq('id', bookingId)
  await advanceBookingToPaid(bookingId)
  const client = await createAuthedClient(
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  )
  const { error } = await client.rpc('transition_booking_state', {
    p_booking_id:    bookingId,
    p_target_status: 'in_progress',
    p_notify:        false,
  })
  if (error) throw new Error(`advance to in_progress failed: ${error.message}`)
  await client.auth.signOut()
}

export async function cancelBookingAsCustomer(bookingId: string): Promise<void> {
  const client = await createAuthedClient(
    process.env.E2E_CUSTOMER_EMAIL!,
    process.env.E2E_CUSTOMER_PASSWORD!,
  )
  const { error } = await client.rpc('transition_booking_state', {
    p_booking_id:    bookingId,
    p_target_status: 'cancelled',
    p_notify:        false,
  })
  if (error) throw new Error(`cancel booking failed: ${error.message}`)
  await client.auth.signOut()
}

// ─── Cleaner profile helpers ──────────────────────────────────────────────────

export async function setCleanerRole(userId: string, role: 'cleaner_pending' | 'cleaner_active'): Promise<void> {
  await db.from('profiles').update({ role }).eq('id', userId)
  await db.from('cleaner_profiles').update({
    onboarding_complete: role === 'cleaner_active',
  }).eq('user_id', userId)
  await db.from('cleaner_applications').update({
    status: role === 'cleaner_active' ? 'approved' : 'submitted',
  }).eq('cleaner_id', userId)
}

export async function approveCleanerInDb(userId: string): Promise<void> {
  await db.from('profiles').update({ role: 'cleaner_active', approved_at: new Date().toISOString() }).eq('id', userId)
}

// ─── Ledger helpers ───────────────────────────────────────────────────────────

export async function getLedgerEvents(bookingId: string) {
  const { data, error } = await db
    .from('payment_ledger_events')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function seedLedgerAuthorized(bookingId: string, amountCents = 5000): Promise<void> {
  await db.from('payment_ledger_events').insert({
    booking_id:      bookingId,
    event_type:      'PAYMENT_AUTHORIZED',
    amount_cents:    amountCents,
    stripe_event_id: `seed_auth_${bookingId}`,
    metadata:        {},
  })
}
