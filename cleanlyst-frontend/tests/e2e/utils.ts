import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient, type User, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const envPath = path.resolve(projectRoot, '.env.playwright')

dotenv.config({ path: envPath })

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_CUSTOMER_EMAIL',
  'E2E_CUSTOMER_PASSWORD',
  'E2E_CLEANER_EMAIL',
  'E2E_CLEANER_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
] as const

const missingEnv = requiredEnv.filter((key) => !process.env[key])
if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables in ${envPath}: ${missingEnv.join(', ')}`)
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
if (serviceRoleKey.includes('publishable') || serviceRoleKey.startsWith('sbp_') || serviceRoleKey.startsWith('sb_publishable_')) {
  throw new Error(
    `SUPABASE_SERVICE_ROLE_KEY appears to be a publishable key. Use the Supabase service role key instead of a publishable API key in ${envPath}.`,
  )
}

export const TEST_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  E2E_CUSTOMER_EMAIL: process.env.E2E_CUSTOMER_EMAIL as string,
  E2E_CUSTOMER_PASSWORD: process.env.E2E_CUSTOMER_PASSWORD as string,
  E2E_CLEANER_EMAIL: process.env.E2E_CLEANER_EMAIL as string,
  E2E_CLEANER_PASSWORD: process.env.E2E_CLEANER_PASSWORD as string,
  E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL as string,
  E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD as string,
  PLAYWRIGHT_TEST_BASE_URL: process.env.PLAYWRIGHT_TEST_BASE_URL,
} as const

export const serviceClient: SupabaseClient = createClient(
  TEST_ENV.SUPABASE_URL,
  TEST_ENV.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
)

async function findAuthUser(email: string): Promise<User | null> {
  const { data, error } = await serviceClient.auth.admin.listUsers({ query: email, page: 1, perPage: 100 })
  if (error) throw error
  return (data?.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function createAuthUser(email: string, password: string, fullName: string) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) {
    throw error
  }
  return data.user
}

async function upsertProfile(userId: string, email: string, role: string, extraValues: Record<string, unknown> = {}) {
  const { error } = await serviceClient
    .from('profiles')
    .upsert({ id: userId, email, role, ...extraValues }, { onConflict: 'id' })
  if (error) throw error
}

async function upsertCleanerProfile(userId: string) {
  const { error } = await serviceClient
    .from('cleaner_profiles')
    .upsert(
      {
        user_id: userId,
        business_name: 'Test Cleanlyst Service',
        bio: 'Reliable test cleaner for E2E coverage.',
        service_radius_km: 30,
        hourly_rate_cents: 1800,
        currency: 'GBP',
        status: 'approved',
        onboarding_complete: true,
        average_rating: 4.9,
        review_count: 8,
      },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

async function seedWeeklyAvailability(cleanerId: string) {
  const { error: deleteError } = await serviceClient.from('availability_slots').delete().eq('cleaner_id', cleanerId)
  if (deleteError) throw deleteError

  const slots = Array.from({ length: 7 }, (_, index) => ({
    cleaner_id: cleanerId,
    day_of_week: index,
    start_time: '09:00:00',
    end_time: '17:00:00',
    active: true,
  }))

  const { error } = await serviceClient.from('availability_slots').insert(slots)
  if (error) throw error
}

async function seedCleanerServices(cleanerId: string) {
  const serviceId = cleanerId
  const { error } = await serviceClient
    .from('services')
    .upsert(
      [
        {
          id: serviceId,
          cleaner_id: cleanerId,
          title: 'Standard Cleaning',
          description: 'Full home clean for smaller properties.',
          category: 'standard',
          base_price_cents: 3000,
          duration_minutes: 90,
          active: true,
        },
      ],
      { onConflict: 'id' },
    )
  if (error) throw error
}

async function upsertCustomerPreferences(customerId: string) {
  const { error } = await serviceClient.from('customer_preferences').upsert(
    {
      customer_id: customerId,
      address_line_1: '10 Test Street',
      address_line_2: 'Unit 1',
      postcode: 'WN1 1AA',
      has_pets: false,
      preferred_cleaner_gender: 'no_preference',
      room_count: 2,
      notes: 'Please bring eco-friendly cleaning supplies.',
      property_type: 'terraced_house',
      bedrooms: '2',
      bathrooms: '1',
      setup_completed_at: new Date().toISOString(),
    },
    { onConflict: 'customer_id' },
  )
  if (error) throw error
}

async function upsertAdminProfile(userId: string) {
  const { error } = await serviceClient
    .from('profiles')
    .upsert({ id: userId, role: 'admin' }, { onConflict: 'id' })
  if (error) throw error
}

export async function ensureUserWithProfile(email: string, password: string, fullName: string, role: string) {
  let user = await findAuthUser(email)
  if (!user) {
    user = await createAuthUser(email, password, fullName)
  }
  await upsertProfile(user.id, email, role, { full_name: fullName, city: 'Wigan' })

  if (role.startsWith('cleaner')) {
    await upsertCleanerProfile(user.id)
    await seedWeeklyAvailability(user.id)
    await seedCleanerServices(user.id)
  }

  if (role === 'customer') {
    await upsertCustomerPreferences(user.id)
  }

  // Note: admin role is already handled by upsertProfile above.
  // upsertAdminProfile was redundant and overwrote full_name with null,
  // violating the NOT NULL constraint on a fresh database.

  return user
}

export async function seedTestData() {
  await ensureUserWithProfile(TEST_ENV.E2E_CUSTOMER_EMAIL, TEST_ENV.E2E_CUSTOMER_PASSWORD, 'E2E Customer', 'customer')
  const cleanerUser = await ensureUserWithProfile(TEST_ENV.E2E_CLEANER_EMAIL, TEST_ENV.E2E_CLEANER_PASSWORD, 'E2E Cleaner', 'cleaner_active')
  await ensureUserWithProfile(TEST_ENV.E2E_ADMIN_EMAIL, TEST_ENV.E2E_ADMIN_PASSWORD, 'E2E Admin', 'admin')

  // Clear any lingering availability overrides so future test dates are not blocked.
  // Overrides are set when a cleaner accepts a booking; without cleanup they accumulate
  // across test runs and prevent the E2E cleaner from appearing in searches.
  if (cleanerUser?.id) {
    await serviceClient.from('availability_overrides').delete().eq('cleaner_id', cleanerUser.id)
  }
}

export async function findLatestBookingForCustomer(customerId: string) {
  const { data, error } = await serviceClient
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Record<string, unknown> | null
}

export async function updateBooking(bookingId: string, patch: Record<string, unknown>) {
  const { error } = await serviceClient.from('bookings').update(patch).eq('id', bookingId)
  if (error) throw error
}

export async function getUserIdByEmail(email: string) {
  const user = await findAuthUser(email)
  if (!user?.id) throw new Error(`Unable to find user id for ${email}`)
  return user.id
}

export interface BookingFinancials {
  booking_id: string
  quote_cents: number
  platform_fee_cents: number
  booking_fee_cents: number
  cleaner_payout_cents: number
  service_price_cents: number
  cleaner_commission_cents: number
  platform_revenue_cents: number
  booking_fee_percent: number
  cleaner_commission_percent: number
  currency: string
}

export async function findBookingFinancials(bookingId: string): Promise<BookingFinancials | null> {
  const { data, error } = await serviceClient
    .from('booking_financials')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw error
  return data as BookingFinancials | null
}

export async function findAllCompletedBookingsWithFinancials(): Promise<
  Array<{ booking_id: string } & BookingFinancials>
> {
  const { data, error } = await serviceClient
    .from('bookings')
    .select('id, booking_financials(*)')
    .eq('status', 'completed')
    .not('booking_financials', 'is', null)
    .limit(50)
  if (error) throw error
  return (data ?? []).flatMap((b: Record<string, unknown>) => {
    const fin = b.booking_financials as BookingFinancials | null
    return fin ? [{ ...fin, booking_id: b.id as string }] : []
  })
}

export async function cleanupBookingsForCustomer(customerId: string): Promise<void> {
  // Collect booking IDs first so we can clean up FK-dependent child tables.
  const { data: rows } = await serviceClient
    .from('bookings')
    .select('id')
    .eq('customer_id', customerId)
  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id)
  if (ids.length === 0) return

  // Delete child records that reference bookings (foreign key constraints).
  // The transactions table has transactions_booking_id_fkey; other tables
  // (payments, payouts, booking_status_events) should cascade or be handled here.
  await serviceClient.from('transactions').delete().in('booking_id', ids)
  await serviceClient.from('payouts').delete().in('booking_id', ids)
  await serviceClient.from('payments').delete().in('booking_id', ids)
  await serviceClient.from('booking_status_events').delete().in('booking_id', ids)
  await serviceClient.from('notifications').delete().in('booking_id', ids)

  const { error } = await serviceClient.from('bookings').delete().eq('customer_id', customerId)
  if (error) throw error
}

export async function getLatestBookingStatus(bookingId: string): Promise<string | null> {
  const { data, error } = await serviceClient
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle()
  if (error) throw error
  return (data as { status: string } | null)?.status ?? null
}
