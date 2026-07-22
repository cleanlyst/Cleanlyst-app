/**
 * Supabase database types for Cleanlyst.
 *
 * These are hand-written to match the schema defined in supabase/migrations/.
 * For full auto-generated types run:
 *   supabase gen types typescript --linked > supabase/types/generated.ts
 */

// ── ENUMS ─────────────────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'cleaner_pending' | 'cleaner_active' | 'admin'
export type CleanerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type CleanerType = 'individual' | 'business'
export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_info'
export type ApplicationStep = 'personal_details' | 'documents' | 'dbs' | 'insurance' | 'submitted'
export type DocumentType = 'id_document' | 'dbs_document' | 'insurance_document'
export type DocumentStatus = 'pending' | 'approved' | 'rejected'
export type BookingStatus =
  | 'pending_request'
  | 'accepted'
  | 'declined'
  | 'paid_pending_start'
  | 'scheduled'
  | 'estimate_proposed'
  | 'awaiting_customer_payment'
  | 'payment_authorized'
  | 'estimate_adjustment_requested'
  | 'in_progress'
  | 'completion_pending_customer'
  | 'completed'
  | 'cancelled'
  | 'cleaner_declined'
  | 'cleaner_cancelled'
  | 'cleaner_no_show'
  | 'refunded'
  | 'disputed'
  | 'reassign_requested'
export type PaymentStatus = 'unpaid' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'offline'
export type PayoutStatus = 'pending' | 'processing' | 'released' | 'paid' | 'failed'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'inactive' | 'cancelled'

// ── MEMBERSHIP (Phase M) ───────────────────────────────────────────────────────

export type MembershipStatus = 'free' | 'active' | 'paused' | 'cancelled' | 'complimentary'
export type BookingPaymentMethod = 'card' | 'cash' | 'bank_transfer'

// ── TABLES ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  is_verified: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface CleanerProfile {
  user_id: string
  status: CleanerStatus
  cleaner_type: CleanerType | null
  business_name: string | null
  bio: string | null
  years_experience: number | null
  service_radius_km: number | null
  stripe_account_id: string | null
  onboarding_complete: boolean
  approval_date: string | null
  average_rating: number | null
  total_reviews: number
  total_jobs_completed: number
  total_earnings_cents: number
  /** Payment methods the cleaner accepts for bookings (Phase M). Defaults to ['card']. */
  accepted_payment_methods: BookingPaymentMethod[]
  created_at: string
  updated_at: string
}

export interface CustomerPreferences {
  customer_id: string
  address: string | null
  city: string | null
  postcode: string | null
  preferences: Record<string, unknown>
  property_details: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  cleaner_id: string
  title: string
  description: string | null
  category: string | null
  price_pence: number
  duration_minutes: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface AvailabilitySlot {
  id: string
  cleaner_id: string
  day_of_week: number // 0=Sunday, 6=Saturday
  start_time: string  // HH:MM:SS
  end_time: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  customer_id: string
  cleaner_id: string
  service_id: string
  service_title_snapshot: string | null
  category_snapshot: string | null
  description_snapshot: string | null
  location_text: string
  latitude: number | null
  longitude: number | null
  notes: string | null
  scheduled_start: string
  scheduled_end: string
  quote_cents: number
  cleaner_payout_cents: number
  currency: string
  stripe_payment_intent_id: string | null
  status: BookingStatus
  payment_status: PaymentStatus
  /** How the customer will pay (or paid) for this booking. Null for pre-Phase M bookings. */
  payment_method: BookingPaymentMethod | null
  no_show_reported_at: string | null
  no_show_action: string | null
  booking_request_id: string | null
  estimated_hours: number | null
  accepted_at: string | null
  started_at: string | null
  completed_at: string | null
  customer_confirmed_completed_at: string | null
  dispute_opened_at: string | null
  dispute_resolved_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  // Estimate adjustment fields (Phase F2)
  proposed_total_cents: number | null
  adjustment_amount_cents: number | null
  adjustment_requested_at: string | null
  customer_adjustment_response_at: string | null
  adjustment_reason: string | null
  created_at: string
  updated_at: string
}

export interface BookingFinancials {
  booking_id: string
  service_price_cents: number
  booking_fee_cents: number
  cleaner_commission_cents: number
  cleaner_payout_cents: number
  platform_revenue_cents: number
  booking_fee_percent: number
  cleaner_commission_percent: number
  /** @deprecated use platform_revenue_cents */
  platform_fee_cents: number
  /** @deprecated use service_price_cents */
  quote_cents: number
  currency: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  booking_id: string
  sender_id: string
  message: string
  read_at: string | null
  created_at: string
}

export interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number // 1–5
  comment: string | null
  created_at: string
}

export interface Payment {
  id: string
  booking_id: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  status: PaymentStatus
  amount_cents: number
  currency: string
  platform_fee_cents: number | null
  cleaner_payout_cents: number | null
  authorized_at: string | null
  captured_at: string | null
  refunded_at: string | null
  failed_at: string | null
  last_webhook_event_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Payout {
  id: string
  booking_id: string
  cleaner_id: string
  payment_id: string | null
  amount_cents: number
  currency: string
  stripe_transfer_id: string | null
  status: PayoutStatus
  released_at: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  booking_id: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface CleanerApplication {
  id: string
  cleaner_id: string
  status: ApplicationStatus
  current_step: ApplicationStep
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  requested_info: string | null
  personal_details: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CleanerApplicationDocument {
  id: string
  application_id: string
  cleaner_id: string
  document_type: DocumentType
  file_path: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
  admin_verified: boolean
  admin_notes: string | null
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface CleanerSubscription {
  cleaner_id: string
  status: SubscriptionStatus
  trial_started_at: string
  trial_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface PlatformSettings {
  id: string
  booking_fee_percent: number
  cleaner_commission_percent: number
  booking_fee_fixed_cents: number
  support_email: string | null
  created_at: string
  updated_at: string
}

// ── MEMBERSHIP TABLES (Phase M) ───────────────────────────────────────────────

export interface MembershipPlan {
  id: string
  name: string
  description: string | null
  price_pence: number
  billing_interval: 'monthly' | 'annual'
  stripe_price_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CustomerMembership {
  id: string
  customer_id: string
  plan_id: string | null
  status: MembershipStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  trial_ends_at: string | null
  cancelled_at: string | null
  paused_at: string | null
  granted_by: string | null
  grant_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── DATABASE TYPE MAP (for typed Supabase client) ─────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      cleaner_profiles: { Row: CleanerProfile; Insert: Partial<CleanerProfile> & { user_id: string }; Update: Partial<CleanerProfile> }
      customer_preferences: { Row: CustomerPreferences; Insert: Partial<CustomerPreferences> & { customer_id: string }; Update: Partial<CustomerPreferences> }
      services: { Row: Service; Insert: Omit<Service, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Service> }
      availability_slots: { Row: AvailabilitySlot; Insert: Omit<AvailabilitySlot, 'id' | 'created_at' | 'updated_at'>; Update: Partial<AvailabilitySlot> }
      bookings: { Row: Booking; Insert: Omit<Booking, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Booking> }
      booking_financials: { Row: BookingFinancials; Insert: BookingFinancials; Update: Partial<BookingFinancials> }
      messages: { Row: Message; Insert: Omit<Message, 'id' | 'created_at'>; Update: Partial<Message> }
      reviews: { Row: Review; Insert: Omit<Review, 'id' | 'created_at'>; Update: never }
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Payment> }
      payouts: { Row: Payout; Insert: Omit<Payout, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Payout> }
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> }
      cleaner_applications: { Row: CleanerApplication; Insert: Omit<CleanerApplication, 'id' | 'created_at' | 'updated_at'>; Update: Partial<CleanerApplication> }
      cleaner_application_documents: { Row: CleanerApplicationDocument; Insert: Omit<CleanerApplicationDocument, 'id' | 'uploaded_at'>; Update: Partial<CleanerApplicationDocument> }
      cleaner_subscriptions: { Row: CleanerSubscription; Insert: Omit<CleanerSubscription, 'trial_started_at' | 'created_at' | 'updated_at'>; Update: Partial<CleanerSubscription> }
      platform_settings: { Row: PlatformSettings; Insert: Omit<PlatformSettings, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PlatformSettings, 'id' | 'created_at'>> }
      membership_plans: { Row: MembershipPlan; Insert: Omit<MembershipPlan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<MembershipPlan> }
      customer_memberships: { Row: CustomerMembership; Insert: Omit<CustomerMembership, 'id' | 'created_at' | 'updated_at'>; Update: Partial<CustomerMembership> }
    }
    Functions: {
      get_my_profile: { Args: Record<never, never>; Returns: Profile }
      is_onboarded: { Args: Record<never, never>; Returns: boolean }
      is_admin: { Args: Record<never, never>; Returns: boolean }
      is_cleaner: { Args: Record<never, never>; Returns: boolean }
      is_cleaner_active: { Args: Record<never, never>; Returns: boolean }
      is_member: { Args: Record<never, never>; Returns: boolean }
      is_booking_participant: { Args: { p_booking_id: string }; Returns: boolean }
      submit_cleaner_application: { Args: { p_application_id: string }; Returns: CleanerApplication }
      admin_review_cleaner_application: {
        Args: {
          p_application_id: string
          p_action: ApplicationStatus
          p_notes?: string | null
          p_requested_info?: string | null
        }
        Returns: CleanerApplication
      }
      admin_set_user_role: { Args: { p_user_id: string; p_role: UserRole }; Returns: Profile }
      transition_booking_state: {
        Args: {
          p_booking_id: string
          p_target_status: BookingStatus
          p_note?: string | null
          p_reassigned_at?: string | null
          p_notify?: boolean
        }
        Returns: Booking
      }
      accept_booking: { Args: { p_booking_id: string }; Returns: Booking }
      start_booking: { Args: { p_booking_id: string }; Returns: Booking }
      complete_booking: { Args: { p_booking_id: string }; Returns: Booking }
      report_cleaner_no_show: { Args: { p_booking_id: string; p_action: 'replacement' | 'refund' }; Returns: Booking }
      get_my_membership: { Args: Record<never, never>; Returns: CustomerMembership | null }
      ensure_customer_membership: { Args: Record<never, never>; Returns: CustomerMembership }
      admin_grant_membership: {
        Args: {
          p_customer_id: string
          p_plan_id?: string | null
          p_reason?: string | null
          p_notes?: string | null
        }
        Returns: CustomerMembership
      }
      admin_cancel_membership: {
        Args: { p_customer_id: string; p_reason?: string | null }
        Returns: CustomerMembership
      }
      admin_pause_membership: {
        Args: { p_customer_id: string; p_reason?: string | null }
        Returns: CustomerMembership
      }
      admin_reactivate_membership: {
        Args: { p_customer_id: string; p_plan_id?: string | null; p_notes?: string | null }
        Returns: CustomerMembership
      }
      admin_upsert_membership_plan: {
        Args: {
          p_id?: string | null
          p_name?: string | null
          p_description?: string | null
          p_price_pence?: number | null
          p_billing_interval?: string | null
          p_stripe_price_id?: string | null
          p_active?: boolean | null
          p_sort_order?: number | null
        }
        Returns: MembershipPlan
      }
      admin_list_members: {
        Args: {
          p_status?: MembershipStatus | null
          p_limit?: number
          p_offset?: number
        }
        Returns: Array<{
          membership_id: string
          customer_id: string
          customer_name: string | null
          customer_email: string
          plan_name: string | null
          status: MembershipStatus
          current_period_end: string | null
          created_at: string
        }>
      }
    }
  }
}
