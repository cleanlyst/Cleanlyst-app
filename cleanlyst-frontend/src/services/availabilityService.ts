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

export async function getCleanerAvailabilityForDate(
  cleanerId: string,
  date: string,
): Promise<AvailabilitySlot[]> {
  const supabase = getSupabaseClient()

  const { data: override, error: overrideError } = await supabase
    .from('availability_overrides')
    .select('is_available')
    .eq('cleaner_id', cleanerId)
    .eq('date', date)
    .maybeSingle()
  if (overrideError) throw overrideError

  if (override?.is_available === false) {
    return []
  }

  const dayOfWeek = new Date(date + 'T00:00:00').getDay()
  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, cleaner_id, day_of_week, start_time, end_time, active')
    .eq('cleaner_id', cleanerId)
    .eq('day_of_week', dayOfWeek)
    .eq('active', true)
    .order('start_time', { ascending: true })
  if (error) throw error

  if (override?.is_available === true) {
    return [
      {
        id: 'override-full-day',
        cleaner_id: cleanerId,
        day_of_week: dayOfWeek,
        start_time: '00:00:00',
        end_time: '23:59:59',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
  }

  return (data ?? []) as AvailabilitySlot[]
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('availability_slots').delete().eq('id', id)
  if (error) throw error
}

export async function getAvailabilityOverrides(
  cleanerId: string,
  fromDate: string,
  toDate: string,
): Promise<AvailabilityOverride[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('availability_overrides')
    .select('id, cleaner_id, date, is_available, reason')
    .eq('cleaner_id', cleanerId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as AvailabilityOverride[]
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

export async function deleteAvailabilityOverride(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('availability_overrides').delete().eq('id', id)
  if (error) throw error
}
