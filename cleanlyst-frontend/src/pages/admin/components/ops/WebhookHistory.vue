<template>
  <div class="flex flex-col gap-2">
    <div v-if="loading" class="text-secondary font-body-sm text-body-sm animate-pulse">Loading…</div>

    <div v-else-if="!events.length" class="text-secondary font-body-sm text-body-sm">
      No webhook events for this booking.
    </div>

    <div class="overflow-x-auto" v-else>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-outline-variant">
            <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Event Type</th>
            <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary hidden sm:table-cell">Stripe ID</th>
            <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Status</th>
            <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Received</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="ev in events"
            :key="ev.id"
            class="border-b border-outline-variant/50 hover:bg-surface-container/40 transition-colors"
          >
            <td class="py-2 px-3 font-mono text-xs">{{ ev.stripe_event_type }}</td>
            <td class="py-2 px-3 font-mono text-xs text-secondary max-w-[140px] truncate hidden sm:table-cell">
              {{ ev.stripe_event_id }}
            </td>
            <td class="py-2 px-3">
              <span
                class="px-1.5 py-0.5 rounded text-xs font-semibold"
                :class="ev.processed_at ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-secondary'"
              >
                {{ ev.processed_at ? 'Processed' : 'Pending' }}
              </span>
            </td>
            <td class="py-2 px-3 font-label-sm text-label-sm text-secondary whitespace-nowrap">
              {{ formatDateTime(ev.received_at) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { formatDateTime }        from '@/utils/format'
import { getSupabaseClient }     from '@/services/supabaseClient'

const props = defineProps<{ bookingId: string }>()

interface WebhookRow {
  id:                string
  stripe_event_id:   string
  stripe_event_type: string
  processed_at:      string | null
  received_at:       string
}

const events  = ref<WebhookRow[]>([])
const loading = ref(false)

async function load(): Promise<void> {
  if (!props.bookingId) return
  loading.value = true
  const supabase = getSupabaseClient()

  // payment_webhook_events has no booking_id — resolve via ledger stripe_event_ids
  const { data: ledgerRows } = await supabase
    .from('payment_ledger_events')
    .select('stripe_event_id')
    .eq('booking_id', props.bookingId)
    .not('stripe_event_id', 'is', null)

  const stripeEventIds = (ledgerRows ?? [])
    .map((r: { stripe_event_id: string }) => r.stripe_event_id)
    .filter(Boolean)

  if (!stripeEventIds.length) {
    events.value  = []
    loading.value = false
    return
  }

  const { data } = await supabase
    .from('payment_webhook_events')
    .select('id, stripe_event_id, stripe_event_type, processed_at, received_at')
    .in('stripe_event_id', stripeEventIds)
    .order('received_at', { ascending: false })
  events.value  = (data ?? []) as WebhookRow[]
  loading.value = false
}

onMounted(load)
watch(() => props.bookingId, load)
</script>
