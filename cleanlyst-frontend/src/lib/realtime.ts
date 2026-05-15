import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/services/supabaseClient'

type ChangeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE'

// Matches the shape of RealtimePostgresChangesFilter without importing the
// internal type, which is not consistently re-exported across SDK versions.
interface PostgresChangesFilter {
  event: ChangeEvent
  schema: string
  table: string
  filter?: string
}

export interface SubscribeOptions<T extends Record<string, unknown>> {
  table: string
  event?: ChangeEvent
  filter?: string
  schema?: string
  onData: (payload: RealtimePostgresChangesPayload<T>) => void
}

export function subscribeToTable<T extends Record<string, unknown>>(
  channelName: string,
  options: SubscribeOptions<T>,
): RealtimeChannel {
  const supabase = getSupabaseClient()
  const { table, event = '*', filter, schema = 'public', onData } = options

  // Build a strongly-typed filter so TypeScript can resolve the correct
  // postgres_changes overload on .on() without Parameters<> tricks.
  const pgFilter: PostgresChangesFilter = { event, schema, table }
  if (filter !== undefined) pgFilter.filter = filter

  return supabase
    .channel(channelName)
    .on('postgres_changes', pgFilter, onData)
    .subscribe()
}

export function subscribeToBookingMessages(
  bookingId: string,
  onInsert: (row: Record<string, unknown>) => void,
): RealtimeChannel {
  return subscribeToTable(`messages:${bookingId}`, {
    table: 'messages',
    event: 'INSERT',
    filter: `booking_id=eq.${bookingId}`,
    onData: (payload) => onInsert(payload.new as Record<string, unknown>),
  })
}

export function subscribeToBookingStatus(
  bookingId: string,
  onUpdate: (row: Record<string, unknown>) => void,
): RealtimeChannel {
  return subscribeToTable(`booking:${bookingId}`, {
    table: 'bookings',
    event: 'UPDATE',
    filter: `id=eq.${bookingId}`,
    onData: (payload) => onUpdate(payload.new as Record<string, unknown>),
  })
}

export function unsubscribe(channel: RealtimeChannel | null): void {
  channel?.unsubscribe()
}
