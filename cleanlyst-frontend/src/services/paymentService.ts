import type { BookingStatus } from '@/types/domain'
import { getSupabaseClient } from '@/services/supabaseClient'
import { getSupabaseConfig } from '@/config/supabase'

// ─── Direct Supabase query helpers ───────────────────────────

export interface Transaction {
  id: string
  booking_id: string
  payment_id: string | null
  stripe_payment_intent_id: string | null
  amount: number
  currency: string
  payment_status: BookingStatus
  created_at: string
}

export async function getBookingTransaction(bookingId: string): Promise<Transaction | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('id, booking_id, payment_id, stripe_payment_intent_id, amount, currency, payment_status, created_at')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw error
  return data as Transaction | null
}

// ─── Edge Function call wrappers ─────────────────────────────

// Derive the Edge Functions base URL from the env-aware Supabase config.
// VITE_SUPABASE_URL does not exist in this project — the config resolves
// VITE_SUPABASE_STAGING_URL / VITE_SUPABASE_PROD_URL based on domain.
const functionsBaseUrl = `${getSupabaseConfig().url}/functions/v1`

async function callFunction<TResponse = unknown, TPayload extends object = object>(
  functionName: string,
  payload: TPayload,
): Promise<TResponse> {
  const supabase = getSupabaseClient()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const token = sessionData.session?.access_token
  if (!token) throw new Error('Missing auth token')

  const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    // Structured error: { success, code, message, details } — or legacy { error }
    const msg = data.message ?? data.error ?? 'Function call failed'
    const err = new Error(msg) as Error & { code?: string; details?: string }
    err.code    = data.code
    err.details = data.details
    throw err
  }

  return data as TResponse
}

export interface CreatePaymentIntentResult {
  client_secret: string
  payment_intent_id: string
  amount_cents: number
  currency: string
}

export async function createPaymentIntent(bookingId: string): Promise<CreatePaymentIntentResult> {
  return callFunction('create-payment-intent', { booking_id: bookingId })
}

export interface CreateCheckoutSessionResult {
  checkout_url: string
  checkout_session_id: string
}

export async function createCheckoutSession(
  bookingId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CreateCheckoutSessionResult> {
  return callFunction('create-checkout-session', {
    booking_id:  bookingId,
    success_url: successUrl,
    cancel_url:  cancelUrl,
  })
}

export interface ProcessPayoutResult {
  payout_id: string
  stripe_transfer_id: string
  amount_cents: number
  status: string
}

export async function processPayout(bookingId: string): Promise<ProcessPayoutResult> {
  return callFunction('process-payout', { booking_id: bookingId })
}

export interface RefundPaymentResult {
  ok: boolean
  refund_id: string
  is_full: boolean
  refund_cents: number
}

export async function refundPayment(
  bookingId: string,
  amountCents?: number,
  reason?: string,
): Promise<RefundPaymentResult> {
  return callFunction('refund-payment', {
    booking_id: bookingId,
    amount_cents: amountCents,
    reason,
  })
}

export interface StripeConnectResult {
  onboarding_url?: string
  stripe_account_id: string
  expires_at?: string
  already_onboarded?: boolean
}

export async function createStripeConnectAccount(): Promise<StripeConnectResult> {
  return callFunction('create-stripe-connect-account', {})
}

export interface VerifyOnboardingResult {
  application_id: string
  status: string
}

export async function verifyCleanerOnboarding(
  applicationId: string,
): Promise<VerifyOnboardingResult> {
  return callFunction('verify-cleaner-onboarding', { application_id: applicationId })
}

export interface ReviewApplicationResult {
  application_id: string
  status: string
}

export async function approveCleaner(applicationId: string): Promise<ReviewApplicationResult> {
  return callFunction('approve-cleaner', { application_id: applicationId })
}

export async function rejectCleaner(
  applicationId: string,
  rejectionReason: string,
): Promise<ReviewApplicationResult> {
  return callFunction('reject-cleaner', { application_id: applicationId, rejection_reason: rejectionReason })
}

export interface AdminAnalyticsResult {
  bookings: {
    total: number
    by_status: Record<string, number>
    completed_mtd: number
    avg_value_cents: number
    recent: Array<{
      id: string
      status: string
      total_price_cents: number
      scheduled_start: string
    }>
  }
  revenue: {
    total_cents: number
    mtd_cents: number
    last_30d_cents: number
  }
  payouts: {
    released_cents: number
    pending_cents: number
  }
  cleaners: {
    active: number
    pending_applications: number
    avg_rating: number
    top_earners: Array<{
      cleaner_id: string
      business_name: string | null
      total_earnings_cents: number
    }>
  }
  customers: {
    total: number
    new_mtd: number
  }
  generated_at: string
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsResult> {
  return callFunction('admin-analytics', {})
}
