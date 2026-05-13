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
  | 'estimate_proposed'
  | 'awaiting_customer_payment'
  | 'payment_authorized'
  | 'in_progress'
  | 'completion_pending_customer'
  | 'completed'
  | 'cancelled'
  | 'cleaner_declined'
  | 'refunded'
  | 'disputed'
export type PaymentStatus = 'unpaid' | 'authorized' | 'captured' | 'refunded' | 'failed'
export type PayoutStatus = 'pending' | 'processing' | 'released' | 'paid' | 'failed'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'inactive' | 'cancelled'

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
  hourly_rate: number | null
  years_experience: number | null
  service_radius_km: number | null
  stripe_account_id: string | null
  onboarding_complete: boolean
  approval_date: string | null
  average_rating: number | null
  total_reviews: number
  total_jobs_completed: number
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
  booking_request_id: string | null
  estimated_hours: number | null
  accepted_at: string | null
  completed_at: string | null
  customer_confirmed_completed_at: string | null
  dispute_opened_at: string | null
  dispute_resolved_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface BookingFinancials {
  booking_id: string
  quote_cents: number
  platform_fee_cents: number
  booking_fee_cents: number
  cleaner_payout_cents: number
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
  booking_fee_fixed_cents: number
  support_email: string | null
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
      platform_settings: { Row: PlatformSettings; Insert: Omit<PlatformSettings, 'id' | 'created_at' | 'updated_at'>; Update: Partial<PlatformSettings> }
    }
    Functions: {
      get_my_profile: { Args: Record<never, never>; Returns: Profile }
      is_onboarded: { Args: Record<never, never>; Returns: boolean }
      is_admin: { Args: Record<never, never>; Returns: boolean }
      is_cleaner: { Args: Record<never, never>; Returns: boolean }
      is_cleaner_active: { Args: Record<never, never>; Returns: boolean }
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
        }
        Returns: Booking
      }
      accept_booking: { Args: { p_booking_id: string }; Returns: Booking }
    }
  }
}
