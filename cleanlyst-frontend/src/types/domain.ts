export type UserRole = 'customer' | 'cleaner_pending' | 'cleaner_active' | 'admin'

export type BookingStatus =
  | 'pending_request'
  | 'accepted'
  | 'declined'
  | 'paid_pending_start'
  | 'scheduled'
  | 'estimate_proposed'
  | 'awaiting_customer_payment'
  | 'payment_authorized'
  | 'in_progress'
  | 'completion_pending_customer'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cleaner_declined'
  | 'cleaner_no_show'
  | 'cancelled'
  | 'paid'
  | 'payout_released'
  | 'cleaner_cancelled'
  | 'reassign_requested'

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_info'

export type ApplicationStep = 'personal_details' | 'documents' | 'dbs' | 'insurance' | 'submitted'

export interface CustomerPreferences {
  customer_id: string
  address_line_1: string | null
  address_line_2: string | null
  postcode: string | null
  city: string | null
  has_pets: boolean | null
  preferred_cleaner_gender: string | null
  room_count: number | null
  property_type: string | null
  bedrooms: string | null
  bathrooms: string | null
  notes: string | null
  setup_completed_at: string | null
}

export interface CleanerApplication {
  id: string
  cleaner_id: string
  status: ApplicationStatus
  current_step: ApplicationStep
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  requested_info: string | null
  personal_details: Record<string, unknown>
}

export interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
  created_at: string
}
