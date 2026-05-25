import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  booking_id: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export function isRead(n: Notification): boolean {
  return n.read_at !== null
}

export async function getNotifications(limit = 50): Promise<Notification[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, booking_id, metadata, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Notification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) throw error
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: Notification) => void,
): RealtimeChannel {
  const supabase = getSupabaseClient()
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new as Notification),
    )
    .subscribe()
}
