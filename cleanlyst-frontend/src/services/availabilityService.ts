import { getSupabaseClient } from './supabaseClient'

export interface AvailabilitySlot {
  id: string
  cleaner_id: string
  day_of_week: number
  start_time: string
  end_time: string
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface AvailabilityOverride {
  id: string
  cleaner_id: string
  date: string
  is_available: boolean
  reason: string | null
}

export async function getCleanerAvailability(cleanerId: string): Promise<AvailabilitySlot[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, cleaner_id, day_of_week, start_time, end_time, active')
    .eq('cleaner_id', cleanerId)
    .eq('active', true)
    .not('day_of_week', 'is', null)
    .order('day_of_week', { ascending: true })
  if (error) throw error
  return (data ?? []) as AvailabilitySlot[]
}

export async function upsertAvailabilitySlots(
  cleanerId: string,
  slots: Array<{ day_of_week: number; start_time: string; end_time: string; active: boolean }>,
): Promise<AvailabilitySlot[]> {
  const supabase = getSupabaseClient()
  const rows = slots
    .filter((s) => s.active)
    .map((s) => ({
      cleaner_id: cleanerId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      active: true,
    }))

  const { error: deleteError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('cleaner_id', cleanerId)
  if (deleteError) throw deleteError

  if (rows.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('availability_slots')
    .insert(rows)
    .select('id, cleaner_id, day_of_week, start_time, end_time, active')
  if (error) throw error
  return (data ?? []) as AvailabilitySlot[]
}

export async function upsertAvailabilityOverride(
  cleanerId: string,
  date: string,
  isAvailable: boolean,
  reason?: string,
): Promise<AvailabilityOverride> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('availability_overrides')
    .upsert(
      { cleaner_id: cleanerId, date, is_available: isAvailable, reason: reason ?? null },
      { onConflict: 'cleaner_id,date' },
    )
    .select('id, cleaner_id, date, is_available, reason')
    .single()
  if (error) throw error
  return data as AvailabilityOverride
}
