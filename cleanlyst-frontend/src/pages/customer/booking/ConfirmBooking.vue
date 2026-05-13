<template>
  <main class="pt-24 pb-20 max-w-7xl mx-auto px-6 lg:px-12">
    <!-- Header -->
    <div class="mb-12">
      <button
        class="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors mb-4"
        @click="goBack"
      >
        <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        <span class="font-label-md text-label-md">Back to Bookings</span>
      </button>

      <div v-if="loading" class="flex items-center gap-4 py-8">
        <div class="loading-spinner"></div>
        <p class="font-body text-body text-secondary">Loading booking details…</p>
      </div>

      <div v-else-if="!booking" class="py-8 text-center">
        <p class="font-body text-body text-secondary">Booking not found.</p>
      </div>

      <div v-else class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="font-h1 text-h1 mb-2">{{ booking.service_title_snapshot ?? 'Cleaning Booking' }}</h1>
          <p class="font-body text-body text-on-surface-variant">Booking ID: #{{ booking.id.slice(0, 8).toUpperCase() }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="px-3 py-1 bg-surface-container-highest text-[10px] font-bold tracking-widest uppercase rounded-sm border border-outline-variant">
            {{ formatStatus(booking.status) }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="booking" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div class="lg:col-span-8 space-y-8">
        <!-- Service Summary Card -->
        <section class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider text-[10px]">Date &amp; Time</p>
              <p class="font-body text-body font-semibold">{{ formatDate(booking.scheduled_start) }}</p>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider text-[10px]">Location</p>
              <p class="font-body text-body">{{ booking.location_text }}</p>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider text-[10px]">Status</p>
              <p class="font-body text-body font-semibold">{{ formatStatus(booking.status) }}</p>
            </div>
          </div>
        </section>

        <!-- Booking notes -->
        <section
          v-if="booking.notes_to_cleaner"
          class="bg-surface-container-lowest border border-outline-variant p-padding-card"
        >
          <h2 class="font-label-md text-label-md mb-3">Notes to Cleaner</h2>
          <p class="font-body text-body text-on-surface-variant">{{ booking.notes_to_cleaner }}</p>
        </section>
      </div>

      <!-- Sidebar -->
      <aside class="lg:col-span-4 space-y-8">
        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <h2 class="font-h2 text-h2 mb-6">Payment Summary</h2>
          <div class="space-y-4 mb-6">
            <div class="flex justify-between font-body text-body">
              <span class="text-on-surface-variant">Service</span>
              <span>{{ formatPence(booking.quote_cents) }}</span>
            </div>
            <div class="pt-4 border-t border-outline-variant flex justify-between font-h2 text-h2">
              <span>Total</span>
              <span>{{ formatPence(booking.quote_cents) }}</span>
            </div>
          </div>

          <button
            v-if="canCancel"
            class="w-full border border-red-600 text-red-600 py-4 font-label-md text-label-md hover:bg-red-50 transition-colors disabled:opacity-50"
            :disabled="cancelling"
            @click="cancelBooking"
          >
            {{ cancelling ? 'Cancelling…' : 'Cancel Booking' }}
          </button>

          <p v-if="cancelError" class="text-caption text-red-600 mt-3">{{ cancelError }}</p>

          <p class="text-caption text-on-surface-variant mt-4 text-center">
            Payment will be released to the provider only after you confirm completion.
          </p>
        </div>

        <div class="bg-surface-container-low border border-outline-variant p-6 flex items-start gap-4">
          <span class="material-symbols-outlined text-on-surface-variant">help</span>
          <div>
            <h3 class="font-label-md text-label-md mb-1">Need assistance?</h3>
            <p class="text-caption text-on-surface-variant mb-3">
              Our trust and safety team is available 24/7 to help with your booking.
            </p>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatPence, formatStatus } from '@/utils/format'

interface BookingDetail {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: string
  quote_cents: number | null
  notes_to_cleaner: string | null
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const booking = ref<BookingDetail | null>(null)
const cancelling = ref(false)
const cancelError = ref('')

const canCancel = computed(() =>
  booking.value ? ['pending_request', 'estimate_proposed'].includes(booking.value.status) : false,
)

onMounted(async () => {
  await auth.init()
  const bookingId = route.query.bookingId as string
  if (!bookingId) { loading.value = false; return }

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .select('id, service_title_snapshot, location_text, scheduled_start, status, quote_cents, notes_to_cleaner')
    .eq('id', bookingId)
    .eq('customer_id', auth.userId)
    .maybeSingle()

  if (!error) booking.value = data as BookingDetail | null
  loading.value = false
})

async function cancelBooking() {
  if (!booking.value) return
  cancelling.value = true
  cancelError.value = ''
  try {
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.value.id)
      .eq('customer_id', auth.userId)
    if (error) throw error
    booking.value = { ...booking.value, status: 'cancelled' }
  } catch (e) {
    cancelError.value = e instanceof Error ? e.message : 'Failed to cancel.'
  } finally {
    cancelling.value = false
  }
}

function goBack() {
  router.push({ name: 'CustomerBookings' })
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
