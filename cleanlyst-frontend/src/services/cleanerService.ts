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
  serviceCategory?: string
  maxRateCents?: number
  minRating?: number
  limit?: number
  offset?: number
}

export async function searchCleaners(params: CleanerSearchParams = {}): Promise<CleanerSearchResult[]> {
  const supabase = getSupabaseClient()
  const { limit = 20, offset = 0, maxRateCents, minRating, serviceCategory } = params

  // When filtering by service category, first collect cleaner IDs that offer it.
  // services.cleaner_id = profiles.id = cleaner_profiles.user_id
  let allowedCleanerIds: string[] | null = null
  if (serviceCategory) {
    const { data: svcRows, error: svcErr } = await supabase
      .from('services')
      .select('cleaner_id')
      .eq('category', serviceCategory)
      .eq('active', true)
    if (svcErr) throw svcErr
    allowedCleanerIds = (svcRows ?? []).map((r) => r.cleaner_id as string)
    if (allowedCleanerIds.length === 0) return []
  }

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
    .range(offset, offset + limit - 1)
    .order('average_rating', { ascending: false })

  if (allowedCleanerIds !== null) {
    query = query.in('user_id', allowedCleanerIds)
  }
  if (maxRateCents !== undefined) {
    query = query.lte('hourly_rate_cents', maxRateCents)
  }
  if (minRating !== undefined) {
    query = query.gte('average_rating', minRating)
  }
  if (params.city) {
    query = query.eq('profiles.city', params.city)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as CleanerSearchResult[]
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
  return data as unknown as CleanerSearchResult | null
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
