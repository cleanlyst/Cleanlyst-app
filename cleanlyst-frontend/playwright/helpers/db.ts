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
  await db.from('transactions').delete().in('booking_id', ids)
  await db.from('payouts').delete().in('booking_id', ids)
  await db.from('payments').delete().in('booking_id', ids)
  await db.from('booking_status_events').delete().in('booking_id', ids)
  await db.from('notifications').delete().in('booking_id', ids)
  await db.from('bookings').delete().eq('customer_id', customerId)
}

// ─── Cleaner profile helpers ──────────────────────────────────────────────────

export async function setCleanerRole(userId: string, role: 'cleaner_pending' | 'cleaner_active'): Promise<void> {
  await db.from('profiles').update({ role }).eq('id', userId)
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
