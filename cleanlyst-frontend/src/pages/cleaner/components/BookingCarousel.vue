<template>
  <section class="carousel-section">
    <div class="carousel-header">
      <h2 class="section-title">Bookings</h2>
      <div class="carousel-controls">
        <router-link :to="{ name: 'CleanerBookings' }" class="section-link">View all</router-link>
        <div v-if="slides.length > 1" class="nav-group">
          <button
            class="nav-btn"
            type="button"
            :disabled="currentIdx === 0"
            @click="prev"
            aria-label="Previous booking"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <span class="pagination">{{ currentIdx + 1 }} / {{ slides.length }}</span>
          <button
            class="nav-btn"
            type="button"
            :disabled="currentIdx === slides.length - 1"
            @click="next"
            aria-label="Next booking"
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
      <span class="material-symbols-outlined empty-icon">event_available</span>
      <p class="empty-label">No active bookings</p>
      <p class="empty-desc">New requests and upcoming jobs will appear here.</p>
    </div>

    <div v-else class="carousel-viewport" aria-live="polite">
      <div
        class="carousel-track"
        :style="{ transform: `translateX(-${currentIdx * 100}%)` }"
      >
        <div
          v-for="b in slides"
          :key="b.id"
          class="carousel-slide"
        >
          <div class="booking-card">
            <div class="booking-img-placeholder">
              <span class="material-symbols-outlined placeholder-icon">home</span>
            </div>

            <div class="booking-body">
              <div class="booking-title-row">
                <div class="booking-title-wrap">
                  <h3 class="booking-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
                  <p class="booking-address">{{ b.location_text }}</p>
                </div>
                <span :class="['status-badge', statusBadgeClass(b.status)]">
                  {{ statusLabel(b.status) }}
                </span>
              </div>

              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">schedule</span>
                  {{ formatDate(b.scheduled_start) }}
                </div>
                <div v-if="b.customer?.full_name" class="booking-meta-item">
                  <span class="material-symbols-outlined">person</span>
                  {{ b.customer.full_name }}
                </div>
                <div v-if="b.quote_cents" class="booking-meta-item">
                  <span class="material-symbols-outlined">payments</span>
                  {{ formatPence(b.quote_cents) }}
                </div>
              </div>

              <div v-if="b.status === 'payment_authorized' && !isWithinStartWindow(b)" class="countdown-banner">
                <span class="material-symbols-outlined">timer</span>
                Available in {{ countdownText(b.scheduled_start) }}
              </div>

              <div v-if="b.status === 'in_progress'" class="in-progress-banner">
                <span class="material-symbols-outlined">cleaning_services</span>
                Cleaning In Progress
              </div>
            </div>

            <div class="booking-ctas">
              <template v-if="b.status === 'pending_request'">
                <button
                  class="btn-primary"
                  type="button"
                  :disabled="loadingId === b.id"
                  @click="emit('accept', b.id)"
                >
                  <span v-if="loadingId === b.id" class="btn-spinner"></span>
                  <span v-else>Accept</span>
                </button>
                <button
                  class="btn-outline"
                  type="button"
                  :disabled="loadingId === b.id"
                  @click="emit('decline', b.id)"
                >
                  Decline
                </button>
              </template>

              <template v-else-if="b.status === 'payment_authorized' && isWithinStartWindow(b)">
                <button
                  class="btn-primary"
                  type="button"
                  :disabled="loadingId === b.id"
                  @click="emit('start', b.id)"
                >
                  <span v-if="loadingId === b.id" class="btn-spinner"></span>
                  <span v-else>Start Cleaning</span>
                </button>
              </template>

              <template v-else-if="b.status === 'in_progress'">
                <button
                  class="btn-primary"
                  type="button"
                  :disabled="loadingId === b.id"
                  @click="emit('end', b.id)"
                >
                  <span v-if="loadingId === b.id" class="btn-spinner"></span>
                  <span v-else>End Job</span>
                </button>
              </template>

              <router-link
                :to="{ name: 'CleanerBookingDetails', params: { bookingId: b.id } }"
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
import { formatPence } from '@/utils/format'

interface CarouselBooking {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: string
  quote_cents?: number | null
  customer?: { id: string; full_name: string; avatar_url: string | null } | null
}

const ACTIVE_STATUSES = [
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
  (e: 'accept', id: string): void
  (e: 'decline', id: string): void
  (e: 'start', id: string): void
  (e: 'end', id: string): void
}>()

const currentIdx = ref(0)

const slides = computed(() => {
  const active = props.bookings
    .filter((b) => ACTIVE_STATUSES.includes(b.status))
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
  return active.slice(0, 5)
})

function prev() {
  if (currentIdx.value > 0) currentIdx.value--
}

function next() {
  if (currentIdx.value < slides.value.length - 1) currentIdx.value++
}

function isWithinStartWindow(b: CarouselBooking): boolean {
  const start = new Date(b.scheduled_start).getTime()
  const now = Date.now()
  return now >= start - 30 * 60 * 1000
}

function countdownText(scheduledStart: string): string {
  const diffMs = new Date(scheduledStart).getTime() - Date.now()
  if (diffMs <= 0) return 'now'
  const totalMins = Math.ceil(diffMs / 60000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.valueOf())) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_request: 'Request',
    estimate_proposed: 'Estimate Sent',
    awaiting_customer_payment: 'Awaiting Payment',
    payment_authorized: 'Confirmed',
    in_progress: 'In Progress',
    completion_pending_customer: 'Pending Review',
  }
  return map[status] ?? status
}

function statusBadgeClass(status: string): string {
  if (status === 'in_progress') return 'badge--active'
  if (status === 'pending_request') return 'badge--pending'
  return 'badge--default'
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
  color: var(--primary, #000000);
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

.section-link:hover {
  color: var(--primary, #000000);
}

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

.nav-btn:hover:not(:disabled) {
  background-color: var(--surface-container, #eeeeee);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination {
  font-size: 13px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  min-width: 2.5rem;
  text-align: center;
}

/* Loading / empty */
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

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

.empty-label {
  font-size: 18px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
}

.empty-desc {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* Carousel */
.carousel-viewport {
  overflow: hidden;
  width: 100%;
}

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

/* Booking card */
.booking-card {
  padding: 1.5rem;
  background-color: #ffffff;
  border: 1px solid var(--outline-variant, #c4c7c7);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.booking-img-placeholder {
  width: 100%;
  height: 7rem;
  background-color: var(--surface-container, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 2rem;
  color: var(--secondary, #5e5e5e);
}

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

.booking-title-wrap {
  flex: 1;
  min-width: 0;
}

.booking-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary, #000000);
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.booking-address {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge--active {
  background-color: var(--primary, #000000);
  color: #ffffff;
}

.badge--pending {
  background-color: var(--surface-container, #eeeeee);
  color: var(--secondary, #5e5e5e);
}

.badge--default {
  background-color: var(--surface-container, #eeeeee);
  color: var(--secondary, #5e5e5e);
}

.booking-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.booking-meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.booking-meta-item .material-symbols-outlined {
  font-size: 1rem;
}

.countdown-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  background-color: var(--surface-container, #eeeeee);
  padding: 0.5rem 0.75rem;
}

.countdown-banner .material-symbols-outlined {
  font-size: 1rem;
}

.in-progress-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  background-color: var(--primary, #000000);
  padding: 0.5rem 0.75rem;
}

.in-progress-banner .material-symbols-outlined {
  font-size: 1rem;
}

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
  background-color: var(--primary, #000000);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 7rem;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline {
  padding: 0.5rem 1.25rem;
  background-color: transparent;
  color: var(--primary, #000000);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  transition: background-color 0.15s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-outline:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

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
