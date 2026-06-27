<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">

    <!-- Payment -->
    <div class="p-padding-card border border-outline-variant bg-surface-container-lowest rounded-md flex flex-col gap-3">
      <p class="font-label-md text-label-md text-secondary flex items-center gap-1">
        <span class="material-symbols-outlined text-base">payments</span>
        Payment
      </p>
      <dl class="flex flex-col gap-2">
        <template v-if="payment.amountCents">
          <div class="flex justify-between">
            <dt class="font-body-sm text-body-sm text-secondary">Amount</dt>
            <dd class="font-label-md text-label-md font-semibold">{{ formatPence(payment.amountCents) }}</dd>
          </div>
        </template>
        <div class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Status</dt>
          <dd>
            <span class="px-1.5 py-0.5 rounded text-xs font-semibold uppercase" :class="paymentStatusColor">
              {{ payment.status ?? '—' }}
            </span>
          </dd>
        </div>
        <div v-if="payment.authorizedAt" class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Authorized</dt>
          <dd class="font-body-sm text-body-sm">{{ formatDateTime(payment.authorizedAt) }}</dd>
        </div>
        <div v-if="payment.capturedAt" class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Captured</dt>
          <dd class="font-body-sm text-body-sm">{{ formatDateTime(payment.capturedAt) }}</dd>
        </div>
        <div v-if="payment.refundedAt" class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Refunded</dt>
          <dd class="font-body-sm text-body-sm">{{ formatDateTime(payment.refundedAt) }}</dd>
        </div>
        <div v-if="payment.stripePaymentIntentId" class="flex justify-between items-start">
          <dt class="font-body-sm text-body-sm text-secondary shrink-0">PI</dt>
          <dd class="font-mono text-xs text-secondary truncate text-right ml-2">{{ payment.stripePaymentIntentId }}</dd>
        </div>
      </dl>
    </div>

    <!-- Payout -->
    <div class="p-padding-card border border-outline-variant bg-surface-container-lowest rounded-md flex flex-col gap-3">
      <p class="font-label-md text-label-md text-secondary flex items-center gap-1">
        <span class="material-symbols-outlined text-base">send_money</span>
        Payout
      </p>
      <div v-if="!payout.id" class="text-secondary font-body-sm text-body-sm">No payout record yet.</div>
      <dl v-else class="flex flex-col gap-2">
        <div v-if="payout.amountCents" class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Amount</dt>
          <dd class="font-label-md text-label-md font-semibold">{{ formatPence(payout.amountCents) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Status</dt>
          <dd>
            <span class="px-1.5 py-0.5 rounded text-xs font-semibold uppercase" :class="payoutStatusColor">
              {{ payout.status ?? '—' }}
            </span>
          </dd>
        </div>
        <div v-if="payout.releasedAt" class="flex justify-between">
          <dt class="font-body-sm text-body-sm text-secondary">Released</dt>
          <dd class="font-body-sm text-body-sm">{{ formatDateTime(payout.releasedAt) }}</dd>
        </div>
        <div v-if="payout.stripeTransferId" class="flex justify-between items-start">
          <dt class="font-body-sm text-body-sm text-secondary shrink-0">Transfer</dt>
          <dd class="font-mono text-xs text-secondary truncate text-right ml-2">{{ payout.stripeTransferId }}</dd>
        </div>
      </dl>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPence, formatDateTime } from '@/utils/format'
import type { PaymentRecord, PayoutRecord } from '@/services/payments/paymentInvestigation'

const props = defineProps<{
  payment: PaymentRecord
  payout:  PayoutRecord
}>()

const paymentStatusColor = computed(() => {
  const map: Record<string, string> = {
    pending:    'bg-surface-container text-secondary',
    authorized: 'bg-primary-container text-on-primary-container',
    captured:   'bg-secondary-container text-on-secondary-container',
    refunded:   'bg-error-container text-on-error-container',
    failed:     'bg-error-container text-on-error-container',
  }
  return map[props.payment.status ?? ''] ?? 'bg-surface-container text-secondary'
})

const payoutStatusColor = computed(() => {
  const map: Record<string, string> = {
    pending:  'bg-primary-container text-on-primary-container',
    released: 'bg-secondary-container text-on-secondary-container',
    paid:     'bg-secondary-container text-on-secondary-container',
    reversed: 'bg-error-container text-on-error-container',
  }
  return map[props.payout.status ?? ''] ?? 'bg-surface-container text-secondary'
})
</script>
