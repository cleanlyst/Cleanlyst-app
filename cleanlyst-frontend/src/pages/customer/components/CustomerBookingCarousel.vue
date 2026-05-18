<template>
  <section class="carousel-section">
    <div class="carousel-header">
      <h2 class="section-title">Upcoming Bookings</h2>
      <div class="carousel-controls">
        <router-link :to="{ name: 'CustomerBookings' }" class="section-link">View all</router-link>
        <div v-if="slides.length > 1" class="nav-group">
          <button
            class="nav-btn"
            type="button"
            :disabled="currentIdx === 0"
            aria-label="Previous booking"
            @click="prev"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <span class="pagination">{{ currentIdx + 1 }} / {{ slides.length }}</span>
          <button
            class="nav-btn"
            type="button"
            :disabled="currentIdx === slides.length - 1"
            aria-label="Next booking"
            @click="next"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="props.loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading bookings…</p>
    </div>

    <div v-else-if="slides.length === 0" class="empty-state">
      <span class="material-symbols-outlined empty-icon">event_busy</span>
      <p class="empty-label">No upcoming bookings</p>
      <p class="empty-desc">
        <router-link :to="{ name: 'BookCleaner' }" class="empty-link">Book a cleaner</router-link>
        to get started.
      </p>
    </div>

    <div v-else class="carousel-viewport" aria-live="polite">
      <div
        class="carousel-track"
        :style="{ transform: `translateX(-${currentIdx * 100}%)` }"
      >
        <div v-for="b in slides" :key="b.id" class="carousel-slide">
          <div class="booking-card">
            <div class="booking-media">
              <span class="material-symbols-outlined media-icon">cleaning_services</span>
            </div>

            <div class="booking-body">
              <div class="booking-title-row">
                <div class="booking-title-wrap">
                  <h3 class="booking-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
                  <p class="booking-provider">{{ b.cleaner_name ?? 'Your cleaner' }}</p>
                </div>
                <span :class="['status-pill', statusClass(b.status)]">
                  {{ statusLabel(b.status) }}
                </span>
              </div>

              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">calendar_today</span>
                  {{ formatDate(b.scheduled_start) }}
                </div>
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">location_on</span>
                  {{ b.location_text }}
                </div>
                <div v-if="b.quote_cents" class="booking-meta-item">
                  <span class="material-symbols-outlined">payments</span>
                  {{ formatPence(b.quote_cents) }}
                </div>
              </div>

              <div v-if="b.status === 'completion_pending_customer'" class="action-banner">
                <span class="material-symbols-outlined">check_circle</span>
                Your cleaner has finished — please confirm completion.
              </div>
            </div>

            <div class="booking-ctas">
              <button
                v-if="b.status === 'completion_pending_customer'"
                type="button"
                class="btn-primary"
                :disabled="loadingId === b.id"
                @click="emit('confirmComplete', b.id)"
              >
                <span v-if="loadingId === b.id" class="btn-spinner"></span>
                <span v-else>Confirm Complete</span>
              </button>
              <router-link
                :to="{ name: 'CustomerBookingDetails', params: { bookingId: b.id } }"
                class="btn-outline"
              >
                View Booking
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PropType } from 'vue'
import { formatDate, formatPence } from '@/utils/format'

interface CarouselBooking {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: string
  quote_cents?: number | null
  cleaner_name?: string | null
}

const UPCOMING_STATUSES = [
  'pending_request',
  'estimate_proposed',
  'awaiting_customer_payment',
  'payment_authorized',
  'in_progress',
  'completion_pending_customer',
]

const props = defineProps({
  bookings: { type: Array as PropType<CarouselBooking[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingId: { type: String as PropType<string | null>, default: null },
})

const emit = defineEmits<{
  (e: 'confirmComplete', id: string): void
}>()

const currentIdx = ref(0)

const slides = computed(() => {
  const active = props.bookings
    .filter((b) => UPCOMING_STATUSES.includes(b.status))
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
  return active.slice(0, 5)
})

function prev() {
  if (currentIdx.value > 0) currentIdx.value--
}

function next() {
  if (currentIdx.value < slides.value.length - 1) currentIdx.value++
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_request: 'Pending',
    estimate_proposed: 'Accepted',
    awaiting_customer_payment: 'Awaiting Payment',
    payment_authorized: 'Confirmed',
    in_progress: 'In Progress',
    completion_pending_customer: 'Confirm Complete',
  }
  return map[status] ?? status
}

function statusClass(status: string): string {
  if (status === 'completion_pending_customer') return 'pill--warning'
  if (['payment_authorized', 'in_progress'].includes(status)) return 'pill--active'
  if (['pending_request', 'estimate_proposed'].includes(status)) return 'pill--pending'
  return 'pill--default'
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

.carousel-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.carousel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
}

.carousel-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.section-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  text-decoration: none;
}

.section-link:hover { color: var(--primary, #000000); }

.nav-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s;
}

.nav-btn:hover:not(:disabled) { background: var(--surface-container, #eeeeee); }
.nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.pagination {
  font-size: 13px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  min-width: 2.5rem;
  text-align: center;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
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
.loading-text { font-size: 16px; color: var(--secondary, #5e5e5e); }

.empty-state {
  border: 1px dashed var(--outline-variant, #c4c7c7);
  padding: 3rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: var(--outline-variant, #c4c7c7);
  display: block;
  margin: 0 auto 1rem;
}

.empty-label { font-size: 18px; font-weight: 500; color: var(--primary, #000000); margin: 0 0 0.5rem; }
.empty-desc { font-size: 14px; color: var(--secondary, #5e5e5e); margin: 0; }
.empty-link { color: var(--primary, #000000); text-decoration: underline; }

/* Carousel */
.carousel-viewport { overflow: hidden; width: 100%; }

.carousel-track {
  display: flex;
  transition: transform 0.35s ease;
}

.carousel-slide {
  flex: 0 0 100%;
  min-width: 0;
  padding: 0 2px;
  box-sizing: border-box;
}

/* Card */
.booking-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.booking-media {
  width: 100%;
  height: 7rem;
  background: var(--surface-container, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-icon { font-size: 2.5rem; color: var(--secondary, #5e5e5e); }

.booking-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.booking-title-wrap { flex: 1; min-width: 0; }

.booking-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary, #000000);
  margin: 0 0 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.booking-provider {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.status-pill {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pill--pending { background: #fff8e1; color: #e65100; border: 1px solid #ffcc80; }
.pill--active { background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9; }
.pill--warning { background: #fff3e0; color: #e65100; border: 1px solid #ffcc02; }
.pill--default { background: var(--surface-container, #eeeeee); color: var(--secondary, #5e5e5e); }

.booking-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.booking-meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.booking-meta-item .material-symbols-outlined { font-size: 1rem; }

.action-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  font-weight: 500;
  color: #e65100;
  background: #fff3e0;
  padding: 0.625rem 0.875rem;
}

.action-banner .material-symbols-outlined { font-size: 1rem; }

.booking-ctas {
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  justify-content: flex-end;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.5rem 1.25rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 7rem;
}

.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: var(--primary, #000000);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--outline-variant, #c4c7c7);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
}

.btn-outline:hover { background: var(--surface-variant, #e2e2e2); }

.btn-spinner {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
</style>
