<template>
  <main class="page-main">
    <p v-if="props.errorMessage" class="error-msg">{{ props.errorMessage }}</p>

    <section class="page-header">
      <div>
        <h1 class="header-title">Bookings</h1>
        <p class="header-copy">Manage your incoming requests, upcoming jobs, and history.</p>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <span class="metric-label">Incoming</span>
        <p class="metric-value">{{ props.bookingTotals.pending }}</p>
        <p class="metric-sub">Requests to review</p>
      </div>
      <div class="stat-card">
        <span class="metric-label">Upcoming</span>
        <p class="metric-value">{{ props.bookingTotals.accepted }}</p>
        <p class="metric-sub">Confirmed jobs</p>
      </div>
      <div class="stat-card">
        <span class="metric-label">Completed</span>
        <p class="metric-value">{{ props.bookingTotals.completed }}</p>
        <p class="metric-sub">Total jobs finished</p>
      </div>
    </section>

    <div v-if="props.loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading bookings…</p>
    </div>

    <template v-else>
      <!-- Incoming Requests -->
      <section class="book-section">
        <div class="section-header">
          <h2 class="section-title">Incoming Requests</h2>
          <span v-if="pendingBookings.length" class="section-badge">{{ pendingBookings.length }}</span>
        </div>
        <div v-if="!pendingBookings.length" class="empty-state">
          <span class="material-symbols-outlined empty-icon">inbox</span>
          <p class="empty-label">No incoming requests</p>
          <p class="empty-desc">New booking requests from customers will appear here.</p>
        </div>
        <div v-else class="bookings-list">
          <article v-for="b in pendingBookings" :key="b.id" class="booking-card">
            <div class="booking-body">
              <div class="booking-title-row">
                <div>
                  <h3 class="booking-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
                  <p class="booking-address">
                    <span class="material-symbols-outlined meta-icon">location_on</span>
                    {{ b.location_text }}
                  </p>
                </div>
                <span class="status-pill status-pill--pending">New Request</span>
              </div>
              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">calendar_today</span>
                  {{ formatDate(b.scheduled_start) }}
                </div>
              </div>
            </div>
            <div class="booking-ctas">
              <button class="btn-start" type="button" @click="acceptBooking(b.id)">Accept</button>
              <button class="btn-decline" type="button" @click="declineBooking(b.id)">Decline</button>
            </div>
          </article>
        </div>
      </section>

      <!-- Upcoming Jobs -->
      <section class="book-section">
        <div class="section-header">
          <h2 class="section-title">Upcoming Jobs</h2>
        </div>
        <div v-if="!upcomingBookings.length" class="empty-state">
          <span class="material-symbols-outlined empty-icon">event_available</span>
          <p class="empty-label">No upcoming jobs</p>
          <p class="empty-desc">Accepted bookings will be listed here.</p>
        </div>
        <div v-else class="bookings-list">
          <article v-for="b in upcomingBookings" :key="b.id" class="booking-card">
            <div class="booking-body">
              <div class="booking-title-row">
                <div>
                  <h3 class="booking-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
                  <p class="booking-address">
                    <span class="material-symbols-outlined meta-icon">location_on</span>
                    {{ b.location_text }}
                  </p>
                </div>
                <span class="status-pill status-pill--active">{{ formatStatus(b.status) }}</span>
              </div>
              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">calendar_today</span>
                  {{ formatDate(b.scheduled_start) }}
                </div>
              </div>
            </div>
            <div v-if="b.status === 'in_progress'" class="booking-ctas">
              <button class="btn-start" type="button" @click="markCompleted(b.id)">
                Mark Complete
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- Past Bookings -->
      <section class="book-section">
        <div class="section-header">
          <h2 class="section-title">Past Bookings</h2>
        </div>
        <div v-if="!pastBookings.length" class="empty-state">
          <span class="material-symbols-outlined empty-icon">history</span>
          <p class="empty-label">No past bookings</p>
          <p class="empty-desc">Completed and cancelled jobs will appear here.</p>
        </div>
        <div v-else class="bookings-list">
          <article v-for="b in pastBookings" :key="b.id" class="booking-card">
            <div class="booking-body">
              <div class="booking-title-row">
                <div>
                  <h3 class="booking-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
                  <p class="booking-address">
                    <span class="material-symbols-outlined meta-icon">location_on</span>
                    {{ b.location_text }}
                  </p>
                </div>
                <span class="status-pill" :class="statusClass(b.status)">{{ formatStatus(b.status) }}</span>
              </div>
              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">calendar_today</span>
                  {{ formatDate(b.scheduled_start) }}
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'

interface BookingEntry {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: string
}

interface BookingTotals {
  pending: number
  accepted: number
  completed: number
}

const props = defineProps({
  bookingTotals: {
    type: Object as PropType<BookingTotals>,
    default: () => ({ pending: 0, accepted: 0, completed: 0 }),
  },
  errorMessage: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  bookings: { type: Array as PropType<BookingEntry[]>, default: () => [] },
  acceptBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
  declineBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
  markCompleted: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
  formatDate: {
    type: Function as PropType<(value: string) => string>,
    default: (v: string) => v,
  },
  formatStatus: {
    type: Function as PropType<(value: string) => string>,
    default: (v: string) => v,
  },
})

const UPCOMING_STATUSES = [
  'estimate_proposed',
  'awaiting_customer_payment',
  'payment_authorized',
  'in_progress',
  'completion_pending_customer',
]

const PAST_STATUSES = ['completed', 'cleaner_declined', 'cancelled', 'disputed', 'refunded']

const pendingBookings = computed(() => props.bookings.filter((b) => b.status === 'pending_request'))

const upcomingBookings = computed(() =>
  props.bookings.filter((b) => UPCOMING_STATUSES.includes(b.status)),
)

const pastBookings = computed(() => props.bookings.filter((b) => PAST_STATUSES.includes(b.status)))

function statusClass(status: string): string {
  if (status === 'completed') return 'status-pill--completed'
  if (['cleaner_declined', 'cancelled', 'disputed', 'refunded'].includes(status))
    return 'status-pill--cancelled'
  if (UPCOMING_STATUSES.includes(status)) return 'status-pill--active'
  return ''
}
</script>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────────── */
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

/* ── Page shell ───────────────────────────────────────────────── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

/* ── Error ────────────────────────────────────────────────────── */
.error-msg {
  font-size: 14px;
  font-weight: 500;
  color: #ba1a1a;
  background-color: #ffdad6;
  border: 1px solid #ba1a1a;
  border-radius: 0.25rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}

/* ── Page header ──────────────────────────────────────────────── */
.page-header {
  margin-bottom: 3rem;
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-bottom: 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

/* ── Stats grid ───────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 4rem;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stat-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
}

.metric-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
}

.metric-value {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-top: 0.5rem;
}

.metric-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
  margin-top: 0.25rem;
}

/* ── Loading ──────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
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
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

/* ── Booking sections ─────────────────────────────────────────── */
.book-section {
  margin-bottom: 4rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
}

.section-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background-color: var(--primary, #000000);
  color: #ffffff;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

/* ── Empty state ──────────────────────────────────────────────── */
.empty-state {
  border: 1px dashed var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
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
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Bookings list ────────────────────────────────────────────── */
.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Booking card ─────────────────────────────────────────────── */
.booking-card {
  padding: 1.5rem;
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  transition: border-color 0.15s;
}

.booking-card:hover {
  border-color: var(--primary, #000000);
}

.booking-body {
  flex: 1;
}

.booking-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.booking-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--primary, #000000);
  margin: 0 0 0.25rem;
}

.booking-address {
  font-size: 14px;
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
}

.booking-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.booking-meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
}

.booking-meta-item .material-symbols-outlined,
.meta-icon {
  font-size: 1rem;
}

/* ── Booking CTAs ─────────────────────────────────────────────── */
.booking-ctas {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  justify-content: flex-end;
}

/* ── Status pills ─────────────────────────────────────────────── */
.status-pill {
  border-radius: 999px;
  padding: 0.25rem 0.625rem;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-pill--pending {
  background: #fff8e1;
  color: #e65100;
  border: 1px solid #ffcc80;
}

.status-pill--active {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #90caf9;
}

.status-pill--completed {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.status-pill--cancelled {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

/* ── Buttons ──────────────────────────────────────────────────── */
.btn-start {
  padding: 0.5rem 1rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-start:hover {
  opacity: 0.85;
}

.btn-decline {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: #ba1a1a;
  border: 1px solid #ba1a1a;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-decline:hover {
  background-color: #ffebee;
}
</style>
