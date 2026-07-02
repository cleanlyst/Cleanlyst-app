<template>
  <div class="flex flex-col gap-3">

    <!-- Status guard note -->
    <div class="p-3 bg-surface-container rounded-md flex items-start gap-2 text-sm text-secondary">
      <span class="material-symbols-outlined text-base shrink-0 mt-0.5">info</span>
      Actions go through the same RPC guards as the application. Refunds require Stripe credentials configured server-side.
    </div>

    <!-- Current state summary -->
    <dl class="grid grid-cols-2 gap-2 text-sm">
      <div>
        <dt class="text-tertiary font-label-sm text-label-sm">Booking status</dt>
        <dd class="font-semibold">{{ bookingStatus ?? '—' }}</dd>
      </div>
      <div>
        <dt class="text-tertiary font-label-sm text-label-sm">Payment status</dt>
        <dd class="font-semibold">{{ paymentStatus ?? '—' }}</dd>
      </div>
    </dl>

    <!-- Actions -->
    <div class="flex flex-wrap gap-2 mt-1">

      <!-- Open booking in admin panel -->
      <a
        :href="`/admin/bookings/${bookingId}`"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md border border-primary text-primary font-label-md text-label-md hover:bg-primary/10 transition-colors"
      >
        <span class="material-symbols-outlined text-base">open_in_new</span>
        Open Booking
      </a>

      <!-- Trigger refund -->
      <button
        v-if="canRefund"
        :disabled="actioning"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md bg-error text-on-error font-label-md text-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        @click="triggerRefund"
      >
        <span class="material-symbols-outlined text-base">undo</span>
        Issue Refund
      </button>

      <!-- Admin overrides for estimate_adjustment_requested -->
      <template v-if="bookingStatus === 'estimate_adjustment_requested'">
        <button
          :disabled="actioning"
          class="flex items-center gap-1.5 px-4 py-2 rounded-md bg-secondary-container text-on-secondary-container font-label-md text-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          data-testid="admin-force-accept-btn"
          @click="forceAcceptAdjustment"
        >
          <span class="material-symbols-outlined text-base">check_circle</span>
          Force Accept (no charge)
        </button>
        <button
          :disabled="actioning"
          class="flex items-center gap-1.5 px-4 py-2 rounded-md bg-error-container text-on-error-container font-label-md text-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          data-testid="admin-force-cancel-btn"
          @click="forceCancelAdjustment"
        >
          <span class="material-symbols-outlined text-base">cancel</span>
          Force Cancel &amp; Refund
        </button>
      </template>

    </div>

    <!-- Action feedback -->
    <div v-if="actionError" class="px-3 py-2 bg-error-container text-on-error-container rounded text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-base">error</span>
      {{ actionError }}
    </div>
    <div v-if="actionSuccess" class="px-3 py-2 bg-secondary-container text-on-secondary-container rounded text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-base">check_circle</span>
      {{ actionSuccess }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getSupabaseClient } from '@/services/supabaseClient'

const props = defineProps<{
  bookingId:     string
  bookingStatus: string | null
  paymentStatus: string | null
}>()

const emit = defineEmits<{ (e: 'refresh'): void }>()

const actioning    = ref(false)
const actionError  = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)

const canRefund = computed(() =>
  props.paymentStatus === 'captured' &&
  !['refunded', 'cancelled'].includes(props.bookingStatus ?? ''),
)

async function triggerRefund(): Promise<void> {
  actioning.value     = true
  actionError.value   = null
  actionSuccess.value = null

  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('admin_process_refund', {
    p_booking_id: props.bookingId,
    p_reason:     'admin_console',
  })

  actioning.value = false
  if (error) {
    actionError.value = error.message
  } else {
    actionSuccess.value = 'Refund initiated. The booking will update shortly.'
    emit('refresh')
  }
}

async function forceAcceptAdjustment(): Promise<void> {
  actioning.value     = true
  actionError.value   = null
  actionSuccess.value = null

  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('accept_price_adjustment_no_charge', {
    p_booking_id: props.bookingId,
  })

  actioning.value = false
  if (error) {
    actionError.value = error.message
  } else {
    actionSuccess.value = 'Adjustment accepted. Booking is now confirmed.'
    emit('refresh')
  }
}

async function forceCancelAdjustment(): Promise<void> {
  actioning.value     = true
  actionError.value   = null
  actionSuccess.value = null

  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('reject_price_adjustment', {
    p_booking_id: props.bookingId,
    p_action:     'cancel',
  })

  actioning.value = false
  if (error) {
    actionError.value = error.message
  } else {
    actionSuccess.value = 'Booking cancelled. Admin should process refund via Issue Refund.'
    emit('refresh')
  }
}
</script>
