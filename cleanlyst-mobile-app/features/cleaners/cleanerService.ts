import { supabase } from "@/services/supabase";
import type { Cleaner } from "@/types/cleaner";

export interface CleanerServiceOption {
  id: string;
  cleaner_id: string;
  title: string;
  category: string;
  description: string | null;
  base_price_cents: number;
  duration_minutes: number;
  active: boolean;
}

function mapCleanerRecord(record: Record<string, unknown>): Cleaner {
  const profile = record.profiles as Record<string, unknown> | null;
  const hourlyRateCents = record.hourly_rate_cents as number | null;

  return {
    id: String(record.user_id ?? ''),
    name: String(profile?.full_name ?? ''),
    businessName:
      record.business_name === null || record.business_name === undefined
        ? null
        : String(record.business_name),
    bio: record.bio === null || record.bio === undefined ? null : String(record.bio),
    hourlyRate: hourlyRateCents ? hourlyRateCents / 100 : 0,
    hourlyRateCents: hourlyRateCents ?? null,
    currency: record.currency === null || record.currency === undefined ? null : String(record.currency),
    rating: Number(record.average_rating ?? 0),
    averageRating: Number(record.average_rating ?? 0),
    reviewCount: Number(record.review_count ?? 0),
    serviceRadiusKm:
      record.service_radius_km === null || record.service_radius_km === undefined
        ? null
        : Number(record.service_radius_km),
    avatarUrl:
      profile?.avatar_url === null || profile?.avatar_url === undefined
        ? null
        : String(profile?.avatar_url),
    city: profile?.city === null || profile?.city === undefined ? null : String(profile?.city),
  }
}

export async function searchCleaners(query: string): Promise<Cleaner[]> {
  const formattedQuery = query.trim();
  let queryBuilder = supabase
    .from('cleaner_profiles')
    .select(
      `user_id, business_name, bio, hourly_rate_cents, currency, average_rating, review_count, service_radius_km, profiles!inner(full_name, avatar_url, city)`,
    )
    .eq('status', 'approved')
    .order('average_rating', { ascending: false })
    .limit(20);

  if (formattedQuery) {
    const filter = `%${formattedQuery.replace(/%/g, '\\%')}%`;
    queryBuilder = queryBuilder.or(
      `profiles.full_name.ilike.${filter},business_name.ilike.${filter}`,
    );
  }

  const { data, error } = await queryBuilder;
  if (error) throw error;

  return (data ?? []).map((record) => mapCleanerRecord(record as Record<string, unknown>));
}

export async function getCleanerPublicProfile(cleanerId: string): Promise<Cleaner | null> {
  const { data, error } = await supabase
    .from('cleaner_profiles')
    .select(
      `user_id, business_name, bio, hourly_rate_cents, currency, average_rating, review_count, service_radius_km, profiles!inner(full_name, avatar_url, city)`,
    )
    .eq('user_id', cleanerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapCleanerRecord(data as Record<string, unknown>);
}

export async function getCleanerServices(
  cleanerId: string,
): Promise<CleanerServiceOption[]> {
  const { data, error } = await supabase
    .from<CleanerServiceOption>('services')
    .select('id, cleaner_id, title, category, description, base_price_cents, duration_minutes, active')
    .eq('cleaner_id', cleanerId)
    .eq('active', true)
    .order('category')
    .order('title');

  if (error) throw error;
  return (data ?? []) as CleanerServiceOption[];
}
