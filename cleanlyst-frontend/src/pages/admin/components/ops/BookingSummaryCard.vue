<template>
  <div class="border border-outline-variant bg-surface-container-lowest rounded-md p-padding-card">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div class="flex flex-col gap-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-label-lg text-label-lg text-on-surface font-mono truncate">
            {{ booking.id }}
          </span>
          <span
            class="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
            :class="statusColor"
          >{{ formatStatus(booking.status ?? '') }}</span>
          <span
            v-if="booking.paymentStatus"
            class="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
            :class="paymentStatusColor"
          >{{ formatStatus(booking.paymentStatus) }}</span>
        </div>
        <div class="flex items-center gap-3 text-secondary font-body-sm text-body-sm flex-wrap mt-1">
          <span v-if="booking.customerId" class="flex items-center gap-1 font-mono text-xs">
            <span class="material-symbols-outlined text-base">person</span>
            {{ booking.customerId.slice(0, 8) }}…
          </span>
          <span v-if="booking.cleanerId" class="flex items-center gap-1 font-mono text-xs">
            <span class="material-symbols-outlined text-base">cleaning_services</span>
            {{ booking.cleanerId.slice(0, 8) }}…
          </span>
          <span v-if="booking.scheduledStart" class="flex items-center gap-1">
            <span class="material-symbols-outlined text-base">calendar_today</span>
            {{ formatDate(booking.scheduledStart) }}
          </span>
          <span v-if="booking.amountCents" class="flex items-center gap-1">
            <span class="material-symbols-outlined text-base">payments</span>
            {{ formatPence(booking.amountCents) }}
          </span>
        </div>
      </div>

      <div class="flex gap-2 items-center shrink-0">
        <span class="font-label-sm text-label-sm text-secondary">
          Created {{ booking.createdAt ? formatRelativeTime(booking.createdAt) : '—' }}
        </span>
        <button
          class="flex items-center gap-1 text-primary font-label-sm text-label-sm hover:underline"
          @click="$emit('refresh')"
        >
          <span class="material-symbols-outlined text-base">refresh</span>
          Refresh
        </button>
      </div>
    </div>

    <!-- Stripe IDs -->
    <div v-if="stripeIds" class="mt-3 pt-3 border-t border-outline-variant flex flex-col gap-1">
      <div v-for="[label, value] in stripeEntries" :key="label" class="flex items-center gap-2 text-xs text-secondary font-mono">
        <span class="text-tertiary w-28 shrink-0">{{ label }}</span>
        <span class="truncate">{{ value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed }                  from 'vue'
import { formatStatus, formatDate, formatRelativeTime, formatPence } from '@/utils/format'
import type { InvestigationBundle }  from '@/services/payments/paymentInvestigation'

const props = defineProps<{
  booking: InvestigationBundle['booking']
  stripeIds?: InvestigationBundle['stripeIds']
}>()

defineEmits<{ (e: 'refresh'): void }>()

const statusColor = computed(() => {
  const map: Record<string, string> = {
    pending:          'bg-surface-container text-secondary',
    confirmed:        'bg-primary-container text-on-primary-container',
    in_progress:      'bg-tertiary-container text-on-tertiary-container',
    completed:        'bg-secondary-container text-on-secondary-container',
    payout_released:  'bg-secondary-container text-on-secondary-container',
    cancelled:        'bg-error-container text-on-error-container',
    cleaner_cancelled:'bg-error-container text-on-error-container',
    refunded:         'bg-error-container text-on-error-container',
  }
  return map[props.booking.status ?? ''] ?? 'bg-surface-container text-secondary'
})

const paymentStatusColor = computed(() => {
  const map: Record<string, string> = {
    unpaid:     'bg-surface-container text-secondary',
    authorized: 'bg-primary-container text-on-primary-container',
    captured:   'bg-secondary-container text-on-secondary-container',
    refunded:   'bg-error-container text-on-error-container',
    failed:     'bg-error-container text-on-error-container',
  }
  return map[props.booking.paymentStatus ?? ''] ?? 'bg-surface-container text-secondary'
})

const stripeEntries = computed(() => {
  if (!props.stripeIds) return []
  return [
    ['Payment Intent', props.stripeIds.paymentIntentId],
    ['Checkout Session', props.stripeIds.checkoutSessionId],
    ['Charge', props.stripeIds.chargeId],
    ['Transfer', props.stripeIds.transferId],
  ].filter(([, v]) => v) as [string, string][]
})
</script>
