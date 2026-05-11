import type { RealtimeChannel } from '@supabase/supabase-js'
import { computed, onUnmounted, ref } from 'vue'
import {
  getNotifications,
  isRead,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type Notification,
} from '@/services/notificationService'
import { useAuthStore } from '@/stores/auth'

export function useNotifications() {
  const auth = useAuthStore()
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let channel: RealtimeChannel | null = null

  const unreadCount = computed(() => notifications.value.filter((n) => !isRead(n)).length)

  async function load() {
    loading.value = true
    error.value = null
    try {
      notifications.value = await getNotifications()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load notifications'
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: string) {
    await markNotificationRead(id)
    const n = notifications.value.find((n) => n.id === id)
    if (n) n.read_at = new Date().toISOString()
  }

  async function markAllRead() {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    notifications.value.forEach((n) => {
      if (!n.read_at) n.read_at = now
    })
  }

  function subscribe() {
    if (!auth.userId) return
    channel = subscribeToNotifications(auth.userId, (notification) => {
      notifications.value.unshift(notification)
    })
  }

  function unsubscribe() {
    channel?.unsubscribe()
    channel = null
  }

  onUnmounted(unsubscribe)

  return {
    notifications,
    loading,
    error,
    unreadCount,
    load,
    markRead,
    markAllRead,
    subscribe,
    unsubscribe,
  }
}
