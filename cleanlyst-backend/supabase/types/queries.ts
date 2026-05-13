/**
 * Supabase Database Usage Layer — Frontend Query Patterns
 *
 * These are the direct client-side queries the frontend uses.
 * No REST server required. All access controlled by RLS.
 *
 * Import pattern:
 *   import { supabase } from '@/lib/supabase'
 *
 * RLS assumptions per query are noted inline.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the authenticated user's full profile + role (uses security-definer RPC). */
export const getMyProfile = (supabase: SupabaseClient) =>
  supabase.rpc('get_my_profile')

/** Update own profile fields (RLS: id = auth.uid()). */
export const updateProfile = (
  supabase: SupabaseClient,
  userId: string,
  updates: { full_name?: string; phone?: string; avatar_url?: string },
) =>
  supabase.from('profiles').update(updates).eq('id', userId).select().single()

/** Upsert customer preferences (RLS: customer_id = auth.uid()). */
export const upsertCustomerPreferences = (
  supabase: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
) =>
  supabase
    .from('customer_preferences')
    .upsert({ customer_id: userId, ...data }, { onConflict: 'customer_id' })
    .select()
    .single()

// ─────────────────────────────────────────────────────────────────────────────
// CLEANER SEARCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search approved cleaners.
 * RLS: public read on cleaner_profiles where status = 'approved'.
 */
export const searchCleaners = (
  supabase: SupabaseClient,
  filters: {
    city?: string
    minRating?: number
    maxHourlyRate?: number
    serviceCategory?: string
  },
  page = 0,
  pageSize = 20,
) => {
  let query = supabase
    .from('cleaner_profiles')
    .select(
      `
      user_id,
      bio,
      hourly_rate,
      years_experience,
      service_radius_km,
      average_rating,
      total_reviews,
      total_jobs_completed,
      profiles!inner(full_name, avatar_url),
      services(id, title, category, price_pence, active)
    `,
    )
    .eq('status', 'approved')
    .eq('services.active', true)

  if (filters.minRating) {
    query = query.gte('average_rating', filters.minRating)
  }
  if (filters.maxHourlyRate) {
    query = query.lte('hourly_rate', filters.maxHourlyRate)
  }

  return query
    .order('average_rating', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
}

/** Fetch a single cleaner's public profile. */
export const getCleanerProfile = (supabase: SupabaseClient, cleanerId: string) =>
  supabase
    .from('cleaner_profiles')
    .select(
      `
      *,
      profiles(full_name, avatar_url),
      services(*)
    `,
    )
    .eq('user_id', cleanerId)
    .eq('status', 'approved')
    .single()

// ─────────────────────────────────────────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer: create a booking request.
 * RLS: customer_id = auth.uid() and is_customer().
 */
export const createBooking = (
  supabase: SupabaseClient,
  payload: {
    cleaner_id: string
    service_id?: string
    service_title_snapshot: string
    address: string
    city: string
    postcode: string
    start_at: string
    duration_hours: number
    quote_cents: number
    cleaner_payout_cents: number
    currency?: string
    notes?: string
  },
  customerId: string,
) =>
  supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      status: 'pending_request',
      currency: 'GBP',
      ...payload,
    })
    .select()
    .single()

/**
 * Fetch all bookings for the authenticated user (customer or cleaner).
 * RLS: customer_id = auth.uid() OR cleaner_id = auth.uid().
 */
export const getMyBookings = (
  supabase: SupabaseClient,
  status?: string,
  page = 0,
  pageSize = 20,
) => {
  let query = supabase
    .from('bookings')
    .select(
      `
      *,
      booking_financials(quote_cents, platform_fee_cents, cleaner_payout_cents)
    `,
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) query = query.eq('status', status)
  return query
}

/** Cleaner: accept a booking via the accept_booking security-definer RPC. */
export const acceptBooking = (supabase: SupabaseClient, bookingId: string) =>
  supabase.rpc('accept_booking', { p_booking_id: bookingId })

/** Transition booking state via security-definer RPC (cleaner or customer). */
export const transitionBooking = (
  supabase: SupabaseClient,
  bookingId: string,
  targetStatus: string,
  note?: string,
) =>
  supabase.rpc('transition_booking_state', {
    p_booking_id: bookingId,
    p_target_status: targetStatus,
    p_note: note ?? null,
  })

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a review for a completed booking.
 * RLS: reviewer_id = auth.uid(), booking must be completed, one per booking.
 */
export const createReview = (
  supabase: SupabaseClient,
  payload: {
    booking_id: string
    reviewer_id: string
    reviewee_id: string
    rating: number
    comment?: string
  },
) =>
  supabase.from('reviews').insert(payload).select().single()

/**
 * Fetch all reviews for a cleaner (public).
 * RLS: public read.
 */
export const getCleanerReviews = (
  supabase: SupabaseClient,
  cleanerId: string,
  page = 0,
  pageSize = 20,
) =>
  supabase
    .from('reviews')
    .select(
      `
      id, rating, comment, created_at,
      profiles!reviewer_id(full_name, avatar_url)
    `,
    )
    .eq('reviewee_id', cleanerId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

/** Cleaner: upsert a recurring availability slot. */
export const upsertAvailability = (
  supabase: SupabaseClient,
  cleanerId: string,
  slot: { day_of_week: number; start_time: string; end_time: string },
) =>
  supabase
    .from('availability_slots')
    .upsert({ cleaner_id: cleanerId, active: true, ...slot })
    .select()
    .single()

/** Fetch a cleaner's availability (visible to authenticated users). */
export const getCleanerAvailability = (supabase: SupabaseClient, cleanerId: string) =>
  supabase
    .from('availability_slots')
    .select('*')
    .eq('cleaner_id', cleanerId)
    .eq('active', true)
    .order('day_of_week')

/** Cleaner: deactivate an availability slot (soft delete). */
export const deactivateAvailability = (supabase: SupabaseClient, slotId: string) =>
  supabase.from('availability_slots').update({ active: false }).eq('id', slotId)

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch messages for a booking (both parties see them).
 * RLS: is_booking_participant(booking_id).
 */
export const getBookingMessages = (supabase: SupabaseClient, bookingId: string) =>
  supabase
    .from('messages')
    .select(
      `
      id, message, created_at, read_at,
      profiles!sender_id(full_name, avatar_url)
    `,
    )
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

/** Send a message on a booking (RLS: sender_id = auth.uid() + participant). */
export const sendMessage = (
  supabase: SupabaseClient,
  bookingId: string,
  senderId: string,
  message: string,
) =>
  supabase
    .from('messages')
    .insert({ booking_id: bookingId, sender_id: senderId, message })
    .select()
    .single()

/** Mark all unread messages in a booking as read by the current user. */
export const markMessagesRead = (supabase: SupabaseClient, bookingId: string) =>
  supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .is('read_at', null)

/** Subscribe to real-time messages for a booking. */
export const subscribeToMessages = (
  supabase: SupabaseClient,
  bookingId: string,
  onMessage: (payload: unknown) => void,
) =>
  supabase
    .channel(`messages:booking_id=eq.${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `booking_id=eq.${bookingId}`,
      },
      onMessage,
    )
    .subscribe()

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch notifications for the authenticated user. */
export const getNotifications = (supabase: SupabaseClient, unreadOnly = false) => {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (unreadOnly) query = query.is('read_at', null)
  return query
}

/** Mark a notification as read. */
export const markNotificationRead = (supabase: SupabaseClient, notificationId: string) =>
  supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

/** Mark all unread notifications as read for the current user. */
export const markAllNotificationsRead = (supabase: SupabaseClient, userId: string) =>
  supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)

/** Subscribe to real-time notifications for the current user. */
export const subscribeToNotifications = (
  supabase: SupabaseClient,
  userId: string,
  onNotification: (payload: unknown) => void,
) =>
  supabase
    .channel(`notifications:user_id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      onNotification,
    )
    .subscribe()

// ─────────────────────────────────────────────────────────────────────────────
// CLEANER ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the cleaner's own application (all statuses). */
export const getMyApplication = (supabase: SupabaseClient) =>
  supabase
    .from('cleaner_applications')
    .select(
      `
      *,
      cleaner_application_documents(*)
    `,
    )
    .single()

/** Create a new draft application. */
export const createApplication = (supabase: SupabaseClient, cleanerId: string) =>
  supabase
    .from('cleaner_applications')
    .insert({ cleaner_id: cleanerId })
    .select()
    .single()

/** Update personal details on a draft application. */
export const updateApplicationDetails = (
  supabase: SupabaseClient,
  applicationId: string,
  personalDetails: Record<string, unknown>,
) =>
  supabase
    .from('cleaner_applications')
    .update({ personal_details: personalDetails })
    .eq('id', applicationId)
    .select()
    .single()

// ─────────────────────────────────────────────────────────────────────────────
// CLEANER EARNINGS
// ─────────────────────────────────────────────────────────────────────────────

/** Cleaner: fetch own payout history. */
export const getMyPayouts = (supabase: SupabaseClient, page = 0, pageSize = 20) =>
  supabase
    .from('payouts')
    .select(
      `
      *,
      bookings(service_title_snapshot, start_at, completed_at)
    `,
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN QUERIES (require admin RLS role)
// ─────────────────────────────────────────────────────────────────────────────

/** Admin: list all bookings with optional status filter. */
export const adminListBookings = (
  supabase: SupabaseClient,
  status?: string,
  page = 0,
  pageSize = 50,
) => {
  let query = supabase
    .from('bookings')
    .select('*, profiles!customer_id(full_name, email)')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) query = query.eq('status', status)
  return query
}

/** Admin: list pending cleaner applications. */
export const adminListPendingApplications = (supabase: SupabaseClient) =>
  supabase
    .from('cleaner_applications')
    .select(
      `
      *,
      profiles!cleaner_id(full_name, email, avatar_url),
      cleaner_application_documents(*)
    `,
    )
    .in('status', ['submitted', 'under_review'])
    .order('submitted_at', { ascending: true })

/** Admin: update platform settings. */
export const adminUpdatePlatformSettings = (
  supabase: SupabaseClient,
  settingsId: string,
  updates: { booking_fee_percent?: number; booking_fee_fixed_cents?: number; support_email?: string },
) =>
  supabase.from('platform_settings').update(updates).eq('id', settingsId).select().single()
