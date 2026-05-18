import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
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

export interface RealtimeSubscription {
  unsubscribe(): void
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
): RealtimeSubscription {
  const supabase = getSupabaseClient()
  const { table, event = '*', filter, schema = 'public', onData } = options

  const pgFilter: PostgresChangesFilter = { event, schema, table }
  if (filter !== undefined) pgFilter.filter = filter

  return supabase.channel(channelName).on('postgres_changes', pgFilter, onData).subscribe()
}

export function subscribeToBookingMessages(
  bookingId: string,
  onInsert: (row: Record<string, unknown>) => void,
): RealtimeSubscription {
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
): RealtimeSubscription {
  return subscribeToTable(`booking:${bookingId}`, {
    table: 'bookings',
    event: 'UPDATE',
    filter: `id=eq.${bookingId}`,
    onData: (payload) => onUpdate(payload.new as Record<string, unknown>),
  })
}

export function unsubscribe(channel: RealtimeSubscription | null): void {
  channel?.unsubscribe()
}
