<template>
  <div class="flex flex-col gap-2">
    <div v-if="loading" class="text-secondary font-body-sm text-body-sm animate-pulse">Loading…</div>

    <div v-else-if="!notifications.length" class="text-secondary font-body-sm text-body-sm">
      No notifications for this booking.
    </div>

    <div
      v-for="n in notifications"
      :key="n.id"
      class="flex items-start gap-3 p-3 border border-outline-variant bg-surface-container-lowest rounded-md"
    >
      <span class="material-symbols-outlined text-secondary shrink-0 mt-0.5">
        {{ typeIcon(n.notification_type) }}
      </span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-label-sm text-label-sm text-on-surface">
            {{ n.notification_type?.replace(/_/g, ' ') ?? 'Notification' }}
          </span>
          <span
            class="text-xs px-1.5 py-0.5 rounded"
            :class="n.is_read ? 'bg-surface-container text-tertiary' : 'bg-primary-container text-on-primary-container'"
          >
            {{ n.is_read ? 'Read' : 'Unread' }}
          </span>
          <span v-if="n.channel" class="text-xs text-tertiary">{{ n.channel }}</span>
        </div>
        <p v-if="n.message" class="font-body-sm text-body-sm text-secondary mt-0.5 truncate">{{ n.message }}</p>
        <span class="text-xs text-tertiary">{{ formatDateTime(n.created_at) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { formatDateTime }        from '@/utils/format'
import { getSupabaseClient }     from '@/services/supabaseClient'

const props = defineProps<{ bookingId: string }>()

interface NotificationRow {
  id:                string
  notification_type: string | null
  message:           string | null
  is_read:           boolean
  channel:           string | null
  created_at:        string
}

const notifications = ref<NotificationRow[]>([])
const loading       = ref(false)

async function load(): Promise<void> {
  if (!props.bookingId) return
  loading.value = true
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, notification_type, message, is_read, channel, created_at')
    .eq('booking_id', props.bookingId)
    .order('created_at', { ascending: false })
    .limit(50)
  notifications.value = (data ?? []) as NotificationRow[]
  loading.value = false
}

function typeIcon(type: string | null): string {
  const t = type ?? ''
  if (t.includes('cancel'))   return 'cancel'
  if (t.includes('payment'))  return 'payments'
  if (t.includes('confirm'))  return 'check_circle'
  if (t.includes('complete')) return 'task_alt'
  if (t.includes('refund'))   return 'undo'
  if (t.includes('payout'))   return 'send_money'
  return 'notifications'
}

onMounted(load)
watch(() => props.bookingId, load)
</script>
