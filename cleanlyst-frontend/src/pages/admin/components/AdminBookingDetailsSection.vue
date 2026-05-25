<template>
  <main class="admin-booking-detail clnst-page-main">
    <router-link :to="{ name: 'BookingManagement' }" class="back-link">
      <span class="material-symbols-outlined">arrow_back</span>
      Booking Management
    </router-link>

    <p v-if="errorMessage" class="clnst-error-msg">{{ errorMessage }}</p>

    <div v-if="loading && !booking" class="clnst-loading-state">
      <div class="clnst-loading-spinner"></div>
      <p class="clnst-loading-text">Loading booking...</p>
    </div>

    <section v-if="booking" class="detail-card">
      <header class="detail-header">
        <div>
          <p class="detail-kicker">Booking Details</p>
          <h1 class="clnst-header-title">
            {{ booking.service_title_snapshot ?? 'Cleaning Booking' }}
          </h1>
          <p class="clnst-header-copy">#{{ booking.id }}</p>
        </div>
        <span :class="['clnst-status-pill', getStatusPillClass(booking.status)]">
          {{ getBookingStatusLabel(booking, 'admin') }}
        </span>
      </header>

      <div class="detail-grid">
        <div class="detail-block">
          <span class="detail-label">Customer</span>
          <p class="detail-value">{{ booking.customer?.full_name ?? 'Unavailable' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Cleaner</span>
          <p class="detail-value">{{ booking.cleaner_id ?? 'Unassigned' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Schedule</span>
          <p class="detail-value">{{ formatDateTime(booking.scheduled_start) }}</p>
          <p class="detail-sub">{{ formatTimeRange(booking.scheduled_start, booking.scheduled_end) }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Payment</span>
          <p class="detail-value">{{ booking.payment_status ?? 'Unknown' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Location</span>
          <p class="detail-value">{{ booking.location_text || 'Unavailable' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Quote</span>
          <p class="detail-value">{{ formatPence(booking.quote_cents, booking.currency ?? 'GBP') }}</p>
        </div>
      </div>

      <div class="detail-notes">
        <span class="detail-label">Notes</span>
        <p class="detail-value">{{ booking.notes || 'No notes provided.' }}</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getBookingById, type BookingDetailRow } from '@/services/bookingService'
import { formatDateTime, formatPence } from '@/utils/format'
import { getBookingStatusLabel, getStatusPillClass } from '@/utils/bookingStatusLabel'

const route = useRoute()
const booking = ref<BookingDetailRow | null>(null)
const loading = ref(false)
const errorMessage = ref('')

watch(
  () => route.params.bookingId,
  async (value) => {
    const bookingId = getRouteParam(value)
    if (!bookingId) {
      booking.value = null
      errorMessage.value = 'Booking no longer available'
      return
    }

    await loadBooking(bookingId)
  },
  { immediate: true },
)

async function loadBooking(bookingId: string) {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getBookingById(bookingId)
    if (!data) {
      booking.value = null
      errorMessage.value = 'Booking no longer available'
      return
    }

    booking.value = data
  } catch (error) {
    booking.value = null
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load booking.'
  } finally {
    loading.value = false
  }
}

function getRouteParam(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function formatTimeRange(start: string, end: string | null | undefined): string {
  if (!end) return 'Duration TBC'

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) return '-'

  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}
</script>

<style scoped>
.admin-booking-detail {
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  color: var(--secondary, #5e5e5e);
  font-size: 14px;
  font-weight: 600;
}

.detail-card {
  padding: 1.5rem;
  background: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.detail-kicker {
  margin: 0 0 0.5rem;
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  padding: 1.5rem 0;
}

.detail-block,
.detail-notes {
  min-width: 0;
}

.detail-notes {
  padding-top: 1.5rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
}

.detail-label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.detail-value {
  margin: 0;
  color: var(--on-surface, #1a1c1c);
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.detail-sub {
  margin: 0.25rem 0 0;
  color: var(--secondary, #5e5e5e);
  font-size: 14px;
}

@media (min-width: 768px) {
  .detail-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
