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

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="tab-group">
        <button
          v-for="tab in BOOKING_TABS"
          :key="tab.key"
          :class="['tab-btn', list.currentTab.value === tab.key && 'tab-btn--active']"
          type="button"
          @click="list.setTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="filter-divider"></div>
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="Search bookings…"
          type="text"
          @input="onSearchInput"
        />
      </div>
    </div>

    <div v-if="list.loading.value" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading bookings…</p>
    </div>

    <template v-else>
      <div v-if="list.bookings.value.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">
          {{ emptyIcon }}
        </span>
        <p class="empty-label">{{ emptyTitle }}</p>
        <p class="empty-desc">{{ emptyDesc }}</p>
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
              <span class="status-pill" :class="getStatusPillClass(b.status)">{{
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
              v-if="b.status === 'in_progress'"
              class="btn-start"
              type="button"
              @click="handleMarkCompleted(b.id)"
            >
              Finish Job
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
      <div v-if="list.totalCount.value > 0" class="pagination">
        <button
          class="pagination-btn"
          type="button"
          :disabled="list.page.value <= 1"
          @click="list.previousPage()"
        >
          Previous
        </button>
        <span class="pagination-info">
          Page {{ list.page.value }} of {{ list.totalPages.value }}
          <span class="pagination-total">({{ list.totalCount.value }} total)</span>
        </span>
        <button
          class="pagination-btn"
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

/* ── Filter bar ───────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.filter-divider {
  display: none;
  width: 1px;
  height: 1.5rem;
  background: var(--outline-variant, #c4c7c7);
  margin: 0 0.5rem;
}

@media (min-width: 1024px) {
  .filter-divider {
    display: block;
  }
}

/* ── Tab group ────────────────────────────────────────────────── */
.tab-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--surface-container, #eeeeee);
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.tab-btn {
  padding: 0.375rem 1rem;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--secondary, #5e5e5e);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: color 0.15s ease;
}

.tab-btn:hover {
  color: var(--primary, #000000);
}

.tab-btn--active {
  background: #ffffff;
  color: var(--primary, #000000);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* ── Search ───────────────────────────────────────────────────── */
.search-wrap {
  position: relative;
  flex-grow: 1;
  max-width: 20rem;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #747878;
  font-size: 20px;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.375rem;
  font-size: 14px;
  outline: none;
  background: #ffffff;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--primary, #000000);
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
  background: #ffffff;
  color: #4c6c4a;
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

/* ── Pagination ───────────────────────────────────────────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
}

.pagination-btn {
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  border-radius: 0.25rem;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-btn:not(:disabled):hover {
  background: var(--surface-container, #eeeeee);
}

.pagination-info {
  font-size: 14px;
  color: var(--on-surface, #1a1c1c);
}

.pagination-total {
  color: var(--secondary, #5e5e5e);
}

@media (max-width: 768px) {
  .tab-group {
    flex-wrap: wrap;
  }
}
</style>
