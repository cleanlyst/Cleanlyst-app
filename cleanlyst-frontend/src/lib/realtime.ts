import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/services/supabaseClient'

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

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

  const channelConfig: Record<string, unknown> = { event, schema, table }
  if (filter) channelConfig.filter = filter

  return supabase
    .channel(channelName)
    .on('postgres_changes', channelConfig as Parameters<RealtimeChannel['on']>[1], onData)
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
