import { getSupabaseClient } from './supabaseClient'
import { CORE_SERVICE_MATCH_KEYWORDS } from '@/utils/serviceCatalog'

export interface CleanerSearchResult {
  user_id: string
  business_name: string | null
  bio: string | null
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
  serviceSlug?: string
  minRating?: number
  availabilityDate?: string // YYYY-MM-DD format
  availabilityTime?: string // HH:MM format – only used when availabilityDate is also set
  durationMinutes?: number
  limit?: number
  offset?: number
}

function normalizeTimeForQuery(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

function buildServiceMatchFilter(serviceSlug?: string, serviceCategory?: string): string | null {
  if (serviceSlug) {
    const keywords = CORE_SERVICE_MATCH_KEYWORDS[serviceSlug] ?? []
    const terms = keywords.map((keyword) => keyword.trim()).filter(Boolean)
    if (terms.length > 0) {
      return terms
        .flatMap((term) => [
          `title.ilike.%${term}%`,
          `category.ilike.%${term}%`,
          `description.ilike.%${term}%`,
        ])
        .join(',')
    }
  }

  return serviceCategory ? `category.eq.${serviceCategory}` : null
}

function getRequestedWindow(
  availabilityDate?: string,
  availabilityTime?: string,
  durationMinutes = 180,
): { start: string; end: string } | null {
  if (!availabilityDate || !availabilityTime) return null
  const start = new Date(`${availabilityDate}T${availabilityTime}:00`)
  if (Number.isNaN(start.valueOf())) return null
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function searchCleaners(
  params: CleanerSearchParams = {},
): Promise<CleanerSearchResult[]> {
  const supabase = getSupabaseClient()
  const {
    limit = 20,
    offset = 0,
    minRating,
    serviceCategory,
    serviceSlug,
    availabilityDate,
    availabilityTime,
    durationMinutes,
  } = params

  // When filtering by service, first collect cleaner IDs that offer the specific
  // MVP service. Category-only filtering is retained for older call sites.
  // services.cleaner_id = profiles.id = cleaner_profiles.user_id
  let allowedCleanerIds: string[] | null = null
  const serviceFilter = buildServiceMatchFilter(serviceSlug, serviceCategory)
  if (serviceFilter) {
    let serviceQuery = supabase
      .from('services')
      .select('cleaner_id')
      .eq('active', true)

    serviceQuery = serviceQuery.or(serviceFilter)

    const { data: svcRows, error: svcErr } = await serviceQuery
    if (svcErr) throw svcErr
    allowedCleanerIds = (svcRows ?? []).map((r) => r.cleaner_id as string)
    if (allowedCleanerIds.length === 0) return []
  }

  // When filtering by availability date, collect cleaner IDs that are available
  let availableCleanerIds: string[] | null = null
  if (availabilityDate) {
    // PostgreSQL DOW: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // JS getDay() uses the same convention, so no conversion needed.
    const dayOfWeek = new Date(availabilityDate + 'T00:00:00').getDay()

    // Check availability_overrides for this specific date (one-off exceptions)
    const { data: overrideRows, error: overrideErr } = await supabase
      .from('availability_overrides')
      .select('cleaner_id, is_available')
      .eq('date', availabilityDate)
    if (overrideErr) throw overrideErr

    const excludedOverrideIds = new Set<string>()
    const availableOverrideIds = new Set<string>()
    ;(overrideRows ?? []).forEach((row) => {
      const cleanerId = row.cleaner_id as string
      if (row.is_available) {
        availableOverrideIds.add(cleanerId)
      } else {
        excludedOverrideIds.add(cleanerId)
      }
    })

    let slotsQuery = supabase
      .from('availability_slots')
      .select('cleaner_id')
      .eq('day_of_week', dayOfWeek)
      .eq('active', true)

    if (availabilityTime) {
      const normalizedTime = normalizeTimeForQuery(availabilityTime)
      slotsQuery = slotsQuery.lte('start_time', normalizedTime).gt('end_time', normalizedTime)
    }

    const { data: slotRows, error: slotErr } = await slotsQuery
    if (slotErr) throw slotErr

    const availableIds = new Set<string>(availableOverrideIds)
    ;(slotRows ?? []).forEach((r) => availableIds.add(r.cleaner_id as string))
    excludedOverrideIds.forEach((id) => availableIds.delete(id))

    availableCleanerIds = Array.from(availableIds)

    const requestedWindow = getRequestedWindow(availabilityDate, availabilityTime, durationMinutes)
    if (requestedWindow && availableCleanerIds.length > 0) {
      const conflictChecks = await Promise.all(
        availableCleanerIds.map(async (cleanerId) => {
          const { data, error } = await supabase.rpc('cleaner_has_booking_conflict', {
            p_cleaner_id: cleanerId,
            p_start: requestedWindow.start,
            p_end: requestedWindow.end,
          })
          if (error) throw error
          return { cleanerId, hasConflict: data === true }
        }),
      )
      availableCleanerIds = conflictChecks
        .filter((result) => !result.hasConflict)
        .map((result) => result.cleanerId)
    }

    if (availableCleanerIds.length === 0) return []
  }

  let query = supabase
    .from('cleaner_profiles')
    .select(
      `
      user_id,
      business_name,
      bio,
      currency,
      average_rating,
      review_count,
      service_radius_km,
      profiles!inner (
        full_name,
        avatar_url,
        city
      )
    `,
    )
    .eq('status', 'approved')
    .eq('is_available', true)
    .range(offset, offset + limit - 1)
    .order('average_rating', { ascending: false })

  if (allowedCleanerIds !== null) {
    query = query.in('user_id', allowedCleanerIds)
  }
  if (availableCleanerIds !== null) {
    query = query.in('user_id', availableCleanerIds)
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
    .select(
      `
      user_id,
      business_name,
      bio,
      currency,
      average_rating,
      review_count,
      service_radius_km,
      profiles!inner (
        full_name,
        avatar_url,
        city
      )
    `,
    )
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
