import { getSupabaseClient } from './supabaseClient'

export interface Review {
  id: string
  booking_id: string
  customer_id: string
  cleaner_id: string
  rating: number
  comment: string | null
  created_at: string
  profiles: {
    full_name: string
    avatar_url: string | null
  } | null
}

export async function createReview(
  bookingId: string,
  cleanerId: string,
  rating: number,
  comment?: string,
): Promise<Review> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('reviews')
    .insert({ booking_id: bookingId, cleaner_id: cleanerId, rating, comment: comment ?? null })
    .select('*')
    .single()
  if (error) throw error
  return data as Review
}

export async function getCleanerReviews(cleanerId: string): Promise<Review[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      booking_id,
      customer_id,
      cleaner_id,
      rating,
      comment,
      created_at,
      profiles!reviews_customer_id_fkey (
        full_name,
        avatar_url
      )
    `)
    .eq('cleaner_id', cleanerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Review[]
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
