import { getSupabaseClient } from '@/services/supabaseClient'

// ── Types ─────────────────────────────────────────────────────

export type CleanerStatusFilter = 'pending' | 'approved' | 'suspended' | 'deactivated' | 'rejected'

export interface AdminCleanerRow {
  user_id: string
  full_name: string
  email: string
  city: string | null
  avatar_url: string | null
  business_name: string | null
  cleaner_status: string
  is_active: boolean
  average_rating: number
  review_count: number
  total_bookings: number
  completed_bookings: number
  total_earnings_cents: number
  joined_at: string
  approval_date: string | null
  has_availability: boolean
  documents_verified: boolean
  total_count: number
}

export interface AdminCleanerProfile {
  user_id: string
  full_name: string
  email: string
  city: string | null
  country: string | null
  avatar_url: string | null
  phone: string | null
  business_name: string | null
  bio: string | null
  status: string
  is_active: boolean
  average_rating: number
  review_count: number
  onboarding_complete: boolean
  joined_at: string
  approval_date: string | null
  services: AdminCleanerService[]
  upcoming_bookings: AdminCleanerBooking[]
  completed_bookings_count: number
  total_earnings_cents: number
  documents: AdminCleanerDocument[]
  reviews: AdminCleanerReview[]
}

export interface AdminCleanerService {
  id: string
  title: string
  category: string | null
  description: string | null
  base_price_cents: number
  duration_minutes: number | null
  active: boolean
}

export interface AdminCleanerBooking {
  id: string
  status: string
  scheduled_start: string
  service_title: string | null
  quote_cents: number
  customer_name: string | null
}

export interface AdminCleanerDocument {
  id: string
  document_type: string
  file_path: string | null
  mime_type: string | null
  uploaded_at: string | null
  admin_verified: boolean
}

export interface AdminCleanerReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  customer_name: string | null
}

export async function getPendingCleanerApplications() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_applications')
    .select('*')
    .in('status', ['submitted', 'under_review', 'needs_info'])
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

export async function reviewCleanerApplication(
  applicationId: string,
  action: 'approved' | 'rejected' | 'needs_info',
  notes?: string,
  requestedInfo?: string,
) {
  const supabase = getSupabaseClient()

  // Client-side validation before hitting the DB
  if (action === 'rejected') {
    if (!notes || notes.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters.')
    }
  }

  const { data, error } = await supabase.rpc('admin_review_cleaner_application', {
    p_application_id: applicationId,
    p_action: action,
    p_notes: action === 'rejected' ? (notes?.trim() ?? null) : (notes ?? null),
    p_requested_info: requestedInfo ?? null,
  })

  if (error) {
    if (error.message.toLowerCase().includes('not found')) {
      throw new Error('Cleaner application not found.')
    }
    if (error.message.toLowerCase().includes('only admin')) {
      throw new Error('Only admins can approve applications.')
    }
    if (error.message.toLowerCase().includes('cannot be reviewed')) {
      throw new Error('This application cannot be reviewed in its current status.')
    }
    if (error.message.toLowerCase().includes('missing required')) {
      throw new Error('Missing required documents.')
    }
    throw new Error(error.message)
  }

  return data
}

// ── Cleaner list ───────────────────────────────────────────────

export async function getAllCleaners(
  search: string | null,
  status: CleanerStatusFilter | null,
  page: number,
  pageSize: number,
): Promise<{ cleaners: AdminCleanerRow[]; total: number }> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_get_all_cleaners', {
    p_search: search || null,
    p_status: status || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as AdminCleanerRow[]
  const total = rows[0]?.total_count ?? 0
  return { cleaners: rows, total: Number(total) }
}

export async function getCleanerProfile(cleanerId: string): Promise<AdminCleanerProfile> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_get_cleaner_profile', {
    p_cleaner_id: cleanerId,
  })
  if (error) throw new Error(error.message)
  return data as AdminCleanerProfile
}

// ── Cleaner actions ────────────────────────────────────────────

export async function suspendCleaner(cleanerId: string, reason?: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('admin_suspend_cleaner', {
    p_cleaner_id: cleanerId,
    p_reason: reason || null,
  })
  if (error) throw new Error(error.message)
}

export async function reactivateCleaner(cleanerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('admin_reactivate_cleaner', {
    p_cleaner_id: cleanerId,
  })
  if (error) throw new Error(error.message)
}

export async function deactivateCleaner(cleanerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('admin_deactivate_cleaner', {
    p_cleaner_id: cleanerId,
  })
  if (error) throw new Error(error.message)
}

// ── Refund ─────────────────────────────────────────────────────
//
// Card payments MUST go through paymentOrchestrator.refundPayment() (→
// refund-payment Edge Function), the only code that calls Stripe — see
// REFUND_CERTIFICATION_REPORT.md. admin_process_refund never touches
// Stripe, so it was retired from every UI entry point for card payments.
//
// It still has exactly one legitimate use: cash/bank_transfer bookings have
// no stripe_payment_intent_id, so there is no Stripe transaction to reverse
// — refund-payment correctly rejects them with 409 "Payment has no Stripe
// intent to refund". recordManualRefund is the bookkeeping-only path for
// that case: it records that the admin returned the money outside the
// system (in person, bank transfer, etc.). Callers MUST check the payment
// has no stripe_payment_intent_id before calling this — never use it for a
// card payment.
export interface ManualRefundResult {
  booking_id: string
  refund_cents: number
  is_full: boolean
}

export async function recordManualRefund(
  bookingId: string,
  refundCents: number,
  reason: string,
  notes?: string,
): Promise<ManualRefundResult> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_process_refund', {
    p_booking_id:   bookingId,
    p_refund_cents: refundCents,
    p_reason:       reason,
    p_notes:        notes || null,
  })
  if (error) throw new Error(error.message)
  return data as ManualRefundResult
}
