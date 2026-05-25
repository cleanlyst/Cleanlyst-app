<template>
  <main class="clnst-page-main">
    <p v-if="props.errorMessage" class="clnst-error-msg">{{ props.errorMessage }}</p>

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

    <!-- Filter bar -->
    <div class="clnst-filter-bar">
      <div class="clnst-tab-group">
        <button
          v-for="tab in BOOKING_TABS"
          :key="tab.key"
          :class="['clnst-tab-btn', list.currentTab.value === tab.key && 'clnst-tab-btn--active']"
          type="button"
          @click="list.setTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="clnst-filter-divider"></div>
      <div class="clnst-search-wrap">
        <span class="material-symbols-outlined clnst-search-icon">search</span>
        <input
          v-model="searchQuery"
          class="clnst-search-input"
          placeholder="Search bookings…"
          type="text"
          @input="onSearchInput"
        />
      </div>
    </div>

    <div v-if="list.loading.value" class="clnst-loading-state">
      <div class="clnst-loading-spinner"></div>
      <p class="clnst-loading-text">Loading bookings…</p>
    </div>

    <template v-else>
      <div v-if="list.bookings.value.length === 0" class="clnst-empty-state">
        <span class="material-symbols-outlined clnst-empty-icon">
          {{ emptyIcon }}
        </span>
        <p class="clnst-empty-label">{{ emptyTitle }}</p>
        <p class="clnst-empty-desc">{{ emptyDesc }}</p>
      </div>

      <div v-else class="bookings-list">
        <article v-for="b in list.bookings.value" :key="b.id" class="booking-card">
          <div class="booking-body">
            <div class="booking-title-row">
              <div>
                <h3 class="booking-title">
                  {{ b.service_title_snapshot ?? 'Cleaning Booking' }}
                </h3>
                <p class="booking-address">
                  <span class="material-symbols-outlined meta-icon">location_on</span>
                  {{ b.location_text }}
                </p>
              </div>
              <span class="clnst-status-pill" :class="getStatusPillClass(b.status)">{{
                getBookingStatusLabel(b, 'cleaner')
              }}</span>
            </div>
            <div class="booking-meta">
              <div class="booking-meta-item">
                <span class="material-symbols-outlined">calendar_today</span>
                {{ formatDate(b.scheduled_start) }}
              </div>
            </div>
          </div>
          <div class="booking-ctas">
            <button
              v-if="b.status === 'pending_request'"
              class="btn-start"
              type="button"
              @click="handleAcceptBooking(b.id)"
            >
              Accept
            </button>
            <button
              v-if="b.status === 'pending_request'"
              class="btn-decline"
              type="button"
              @click="handleDeclineBooking(b.id)"
            >
              Decline
            </button>
            <button
              v-if="canStartCleaning(b)"
              class="btn-start"
              type="button"
              @click="handleStartBooking(b.id)"
            >
              Start Cleaning
            </button>
            <button
              v-if="b.status === 'in_progress'"
              class="btn-start"
              type="button"
              @click="handleMarkCompleted(b.id)"
            >
              Complete Cleaning
            </button>
            <router-link
              :to="{ name: 'CleanerBookingDetails', params: { bookingId: b.id } }"
              class="btn-view"
            >
              View Booking
            </router-link>
          </div>
        </article>
      </div>

      <!-- Pagination -->
      <div v-if="list.totalCount.value > 0" class="clnst-pagination">
        <button
          class="clnst-pagination-btn"
          type="button"
          :disabled="list.page.value <= 1"
          @click="list.previousPage()"
        >
          Previous
        </button>
        <span class="clnst-pagination-info">
          Page {{ list.page.value }} of {{ list.totalPages.value }}
          <span class="clnst-pagination-total">({{ list.totalCount.value }} total)</span>
        </span>
        <button
          class="clnst-pagination-btn"
          type="button"
          :disabled="list.page.value >= list.totalPages.value"
          @click="list.nextPage()"
        >
          Next
        </button>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PropType } from 'vue'
import { getBookingStatusLabel, getStatusPillClass } from '@/utils/bookingStatusLabel'
import { formatDateTime } from '@/utils/format'
import { useBookingList, BOOKING_TABS } from '@/composables/useBookingList'

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
  startBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
})

const list = useBookingList('cleaner')

const searchQuery = ref('')
let searchTimeout: ReturnType<typeof setTimeout>

onMounted(() => {
  list.fetch()
})

function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list.setSearch(searchQuery.value)
  }, 350)
}

async function handleAcceptBooking(id: string) {
  await props.acceptBooking(id)
  await list.fetch()
}

async function handleDeclineBooking(id: string) {
  await props.declineBooking(id)
  await list.fetch()
}

async function handleMarkCompleted(id: string) {
  await props.markCompleted(id)
  await list.fetch()
}

async function handleStartBooking(id: string) {
  await props.startBooking(id)
  await list.fetch()
}

function canStartCleaning(booking: { status: string; payment_status: string | null; scheduled_start: string }): boolean {
  if (booking.status !== 'accepted' || booking.payment_status !== 'captured') return false
  const start = new Date(booking.scheduled_start)
  if (Number.isNaN(start.valueOf())) return false
  return Date.now() >= start.getTime() - 30 * 60 * 1000
}

const formatDate = formatDateTime

const emptyIcon = computed(() => {
  const tab = list.currentTab.value
  if (tab === 'pending') return 'inbox'
  if (tab === 'active') return 'event_available'
  if (tab === 'completed') return 'check_circle'
  if (tab === 'cancelled') return 'cancel'
  return 'event_busy'
})

const emptyTitle = computed(() => {
  const tab = list.currentTab.value
  if (tab === 'pending') return 'No incoming requests'
  if (tab === 'active') return 'No upcoming jobs'
  if (tab === 'completed') return 'No completed bookings'
  if (tab === 'cancelled') return 'No cancelled bookings'
  return 'No bookings yet'
})

const emptyDesc = computed(() => {
  const tab = list.currentTab.value
  if (tab === 'pending') return 'New booking requests from customers will appear here.'
  if (tab === 'active') return 'Accepted bookings will be listed here.'
  if (tab === 'completed') return 'Completed jobs will appear here.'
  if (tab === 'cancelled') return 'Cancelled and declined bookings will appear here.'
  return 'Your bookings will appear here once customers start requesting your services.'
})

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
  margin-bottom: 3rem;
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

.btn-view {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
}

.btn-view:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

</style>
