<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="border-b border-outline-variant">
          <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Event</th>
          <th class="text-right py-2 px-3 font-label-sm text-label-sm text-secondary">Amount</th>
          <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary hidden md:table-cell">Stripe Event</th>
          <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Timestamp</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="event in events"
          :key="event.id"
          class="border-b border-outline-variant/50 hover:bg-surface-container/40 transition-colors"
        >
          <td class="py-2 px-3">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
              :class="eventColor(event.eventType)"
            >
              <span class="material-symbols-outlined text-xs">{{ eventIcon(event.eventType) }}</span>
              {{ event.eventType.replace(/_/g, ' ') }}
            </span>
          </td>
          <td class="py-2 px-3 text-right font-mono font-semibold" :class="event.amountCents ? 'text-on-surface' : 'text-tertiary'">
            {{ event.amountCents != null ? formatPence(event.amountCents) : '—' }}
          </td>
          <td class="py-2 px-3 font-mono text-xs text-secondary truncate max-w-[160px] hidden md:table-cell">
            {{ event.stripeEventId || '—' }}
          </td>
          <td class="py-2 px-3 font-label-sm text-label-sm text-secondary whitespace-nowrap">
            {{ formatDateTime(event.createdAt) }}
          </td>
        </tr>
        <tr v-if="!events.length">
          <td colspan="4" class="py-4 px-3 text-secondary text-center font-body-sm text-body-sm">
            No ledger events.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { formatPence, formatDateTime } from '@/utils/format'
import type { LedgerEvent, LedgerEventType } from '@/services/payments/paymentLedgerResolver'

defineProps<{ events: LedgerEvent[] }>()

function eventColor(type: LedgerEventType): string {
  const map: Record<LedgerEventType, string> = {
    PAYMENT_AUTHORIZED:              'bg-primary-container text-on-primary-container',
    PAYMENT_CAPTURED:                'bg-secondary-container text-on-secondary-container',
    PAYMENT_REFUNDED:                'bg-error-container text-on-error-container',
    PAYOUT_RELEASED:                 'bg-tertiary-container text-on-tertiary-container',
    PAYOUT_REVERSED:                 'bg-error-container text-on-error-container',
    ESTIMATE_ADJUSTMENT_REQUESTED:   'bg-surface-container text-secondary',
    ESTIMATE_ADJUSTMENT_ACCEPTED:    'bg-secondary-container text-on-secondary-container',
    ESTIMATE_ADJUSTMENT_REJECTED:    'bg-error-container text-on-error-container',
    ADDITIONAL_PAYMENT_AUTHORIZED:   'bg-primary-container text-on-primary-container',
  }
  return map[type] ?? 'bg-surface-container text-secondary'
}

function eventIcon(type: LedgerEventType): string {
  const map: Record<LedgerEventType, string> = {
    PAYMENT_AUTHORIZED:              'lock',
    PAYMENT_CAPTURED:                'payments',
    PAYMENT_REFUNDED:                'undo',
    PAYOUT_RELEASED:                 'send_money',
    PAYOUT_REVERSED:                 'remove_circle',
    ESTIMATE_ADJUSTMENT_REQUESTED:   'price_change',
    ESTIMATE_ADJUSTMENT_ACCEPTED:    'check_circle',
    ESTIMATE_ADJUSTMENT_REJECTED:    'cancel',
    ADDITIONAL_PAYMENT_AUTHORIZED:   'add_card',
  }
  return map[type] ?? 'receipt'
}
</script>
