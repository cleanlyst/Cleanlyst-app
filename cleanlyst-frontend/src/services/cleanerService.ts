import { getSupabaseClient } from './supabaseClient'

export interface CleanerSearchResult {
  user_id: string
  business_name: string | null
  bio: string | null
  hourly_rate_cents: number | null
  currency: string
  average_rating: number
  review_count: number
  service_radius_km: number | null
  profiles: {
    full_name: string
    avatar_url: string | null
    city: string | null
  } | null
}

export interface CleanerSearchParams {
  city?: string
  maxRateCents?: number
  minRating?: number
  limit?: number
  offset?: number
}

export async function searchCleaners(params: CleanerSearchParams = {}): Promise<CleanerSearchResult[]> {
  const supabase = getSupabaseClient()
  const { limit = 20, offset = 0, maxRateCents, minRating } = params

  let query = supabase
    .from('cleaner_profiles')
    .select(`
      user_id,
      business_name,
      bio,
      hourly_rate_cents,
      currency,
      average_rating,
      review_count,
      service_radius_km,
      profiles!inner (
        full_name,
        avatar_url,
        city
      )
    `)
    .eq('status', 'approved')
    .eq('onboarding_complete', true)
    .range(offset, offset + limit - 1)
    .order('average_rating', { ascending: false })

  if (maxRateCents !== undefined) {
    query = query.lte('hourly_rate_cents', maxRateCents)
  }
  if (minRating !== undefined) {
    query = query.gte('average_rating', minRating)
  }
  if (params.city) {
    query = query.ilike('profiles.city', `%${params.city}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CleanerSearchResult[]
}

export async function getCleanerPublicProfile(userId: string): Promise<CleanerSearchResult | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_profiles')
    .select(`
      user_id,
      business_name,
      bio,
      hourly_rate_cents,
      currency,
      average_rating,
      review_count,
      service_radius_km,
      profiles!inner (
        full_name,
        avatar_url,
        city
      )
    `)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as CleanerSearchResult | null
}

export async function updateCleanerProfile(
  userId: string,
  updates: Partial<{
    business_name: string
    bio: string
    hourly_rate_cents: number
    service_radius_km: number
  }>,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ─── cleaner_services junction ────────────────────────────────

export interface CleanerServiceOffering {
  id: string
  cleaner_id: string
  service_id: string
  created_at: string
}

export async function getCleanerServiceOfferings(
  cleanerId: string,
): Promise<CleanerServiceOffering[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_services')
    .select('id, cleaner_id, service_id, created_at')
    .eq('cleaner_id', cleanerId)
  if (error) throw error
  return (data ?? []) as CleanerServiceOffering[]
}

export async function addCleanerServiceOffering(
  cleanerId: string,
  serviceId: string,
): Promise<CleanerServiceOffering> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_services')
    .insert({ cleaner_id: cleanerId, service_id: serviceId })
    .select('id, cleaner_id, service_id, created_at')
    .single()
  if (error) throw error
  return data as CleanerServiceOffering
}

export async function removeCleanerServiceOffering(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('cleaner_services').delete().eq('id', id)
  if (error) throw error
}
