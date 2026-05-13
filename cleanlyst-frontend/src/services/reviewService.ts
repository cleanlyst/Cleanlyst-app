import { getSupabaseClient } from './supabaseClient'

export interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: {
    full_name: string
    avatar_url: string | null
  } | null
}

export async function createReview(
  bookingId: string,
  rating: number,
  comment?: string,
): Promise<Review> {
  const supabase = getSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('You must be signed in to review a booking.')

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('customer_id, cleaner_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (bookingError) throw bookingError
  if (!booking) throw new Error('Booking not found.')

  const revieweeId =
    booking.customer_id === user.id
      ? booking.cleaner_id
      : booking.cleaner_id === user.id
        ? booking.customer_id
        : null
  if (!revieweeId) throw new Error('Only booking participants can leave reviews.')

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      booking_id: bookingId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment: comment ?? null,
    })
    .select(`
      id,
      booking_id,
      reviewer_id,
      reviewee_id,
      rating,
      comment,
      created_at,
      reviewer:profiles!reviewer_id (
        full_name,
        avatar_url
      )
    `)
    .single()
  if (error) throw error
  return data as unknown as Review
}

export async function getCleanerReviews(cleanerId: string): Promise<Review[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      booking_id,
      reviewer_id,
      reviewee_id,
      rating,
      comment,
      created_at,
      reviewer:profiles!reviewer_id (
        full_name,
        avatar_url
      )
    `)
    .eq('reviewee_id', cleanerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function getMyReview(bookingId: string): Promise<Review | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw error
  return data as Review | null
}
