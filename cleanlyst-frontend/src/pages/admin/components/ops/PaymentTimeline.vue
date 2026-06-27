<template>
  <div class="flex flex-col gap-0">
    <div
      v-for="(entry, i) in entries"
      :key="entry.id"
      class="flex gap-3"
    >
      <!-- Connector line + dot -->
      <div class="flex flex-col items-center">
        <div class="w-2.5 h-2.5 rounded-full shrink-0 mt-1" :class="dotColor(entry)"></div>
        <div v-if="i < entries.length - 1" class="w-px flex-1 bg-outline-variant mt-1"></div>
      </div>

      <!-- Content -->
      <div class="pb-4 min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-label-md text-label-md text-on-surface">{{ entry.title }}</span>
          <span class="font-label-sm text-label-sm text-tertiary px-1.5 py-0.5 rounded bg-surface-container text-xs">
            {{ sourceLabel(entry.source) }}
          </span>
        </div>
        <p v-if="entry.description" class="font-body-sm text-body-sm text-secondary mt-0.5">
          {{ entry.description }}
        </p>
        <span class="font-label-sm text-label-sm text-tertiary text-xs">
          {{ formatDateTime(entry.timestamp) }}
        </span>
      </div>
    </div>

    <p v-if="!entries.length" class="text-secondary font-body-sm text-body-sm">
      No timeline entries.
    </p>
  </div>
</template>

<script setup lang="ts">
import { formatDateTime } from '@/utils/format'
import type { TimelineEntry, TimelineSource } from '@/services/payments/paymentTimeline'

defineProps<{ entries: TimelineEntry[] }>()

function dotColor(entry: TimelineEntry): string {
  const src = entry.source
  if (src === 'ledger')        return 'bg-primary'
  if (src === 'booking_event') return 'bg-secondary'
  if (src === 'payout')        return 'bg-tertiary'
  return 'bg-outline'
}

function sourceLabel(source: TimelineSource): string {
  const map: Record<TimelineSource, string> = {
    booking:        'Booking',
    booking_event:  'Status',
    ledger:         'Ledger',
    payout:         'Payout',
  }
  return map[source] ?? source
}
</script>
