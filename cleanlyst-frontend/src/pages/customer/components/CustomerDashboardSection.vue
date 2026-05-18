<template>
  <main class="page-main">
    <section class="page-header mb-4">
      <div>
        <h1 class="header-title">Welcome back, {{ auth.profile?.full_name ?? 'Customer' }}</h1>
      </div>
      <div>
        <router-link :to="{ name: 'BookCleaner' }" class="button-secondary">
          + Book a Cleaner
        </router-link>
      </div>
    </section>

    <div class="content-grid">
      <section class="main-col">
        <CustomerBookingCarousel
          :bookings="props.bookings"
          :loading="props.loading"
          :loading-id="props.actionLoadingId"
          @confirm-complete="props.confirmComplete"
          @payment-done="emit('paymentDone', $event)"
        />
      </section>

      <!-- Sidebar / Insights -->
      <aside class="sidebar">
        <div class="overview-card">
          <h3 class="overview-title">Account Overview</h3>
          <div class="overview-rows">
            <div class="overview-row">
              <span class="overview-label">Total Bookings</span>
              <span class="overview-value">{{ props.bookings.length }}</span>
            </div>
            <div class="overview-row">
              <span class="overview-label">Upcoming</span>
              <span class="overview-value">{{ upcomingBookings.length }}</span>
            </div>
            <div class="overview-row overview-row--last">
              <span class="overview-label">Next Clean</span>
              <span class="overview-value">{{ nextCleanLabel }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Past Bookings Section -->
    <section class="past-section">
      <div class="past-header">
        <h2 class="past-title">Past Bookings</h2>
        <router-link :to="{ name: 'CustomerBookings' }" class="view-all-btn">
          View All History
          <span class="material-symbols-outlined view-all-icon">arrow_forward</span>
        </router-link>
      </div>

      <div v-if="pastBookings.length === 0" class="empty-past">
        <p class="empty-past-text">No past bookings yet.</p>
      </div>

      <div v-else class="past-grid">
        <div v-for="b in pastBookings.slice(0, 3)" :key="b.id" class="past-card">
          <div class="past-card-header">
            <div>
              <p class="past-date">{{ formatDate(b.scheduled_start) }}</p>
              <h4 class="past-name">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h4>
            </div>
            <span class="status-badge" :class="statusClass(b.status)">
              {{ formatStatus(b.status).toUpperCase() }}
            </span>
          </div>
          <div class="cleaner-row">
            <div class="cleaner-avatar">
              <span class="material-symbols-outlined cleaner-avatar-icon">person</span>
            </div>
            <span class="cleaner-name">{{ b.cleaner_name ?? 'Cleaner' }}</span>
          </div>
          <div class="past-footer">
            <span class="past-price">{{ formatPence(b.quote_cents) }}</span>
            <div class="past-actions">
              <router-link
                :to="{ name: 'CustomerBookingDetails', params: { bookingId: b.id } }"
                class="view-btn"
                >View</router-link
              >
              <button class="rebook-btn" @click="rebook(b)">Re-book</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatPence, formatStatus } from '@/utils/format'
import CustomerBookingCarousel from './CustomerBookingCarousel.vue'

export interface BookingWithCleaner {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: string
  payment_status?: string | null
  quote_cents: number | null
  cleaner_name: string | null
  cleaner_id: string | null
}

const auth = useAuthStore()
const router = useRouter()

const UPCOMING_STATUSES = [
  'pending_request',
  'accepted',
  'paid_pending_start',
  'estimate_proposed',
  'awaiting_customer_payment',
  'payment_authorized',
  'in_progress',
  'completion_pending_customer',
]

const PAST_STATUSES = ['completed', 'declined', 'cleaner_declined', 'cancelled', 'disputed', 'refunded']

const upcomingBookings = computed(() =>
  props.bookings.filter((b) => UPCOMING_STATUSES.includes(b.status)),
)

const emit = defineEmits<{
  (e: 'paymentDone', id: string): void
}>()

const props = defineProps({
  bookings: { type: Array as PropType<BookingWithCleaner[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  actionLoadingId: { type: String as PropType<string | null>, default: null },
  cancelBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => Promise.resolve(),
  },
  confirmComplete: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => Promise.resolve(),
  },
})

const pastBookings = computed(() => props.bookings.filter((b) => PAST_STATUSES.includes(b.status)))

const nextCleanLabel = computed(() => {
  const next = upcomingBookings.value
    .filter((b) => b.scheduled_start)
    .sort(
      (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
    )[0]
  if (!next) return '—'
  const diff = Math.ceil(
    (new Date(next.scheduled_start).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
})

function statusClass(status: string): string {
  if (['pending_request', 'accepted', 'estimate_proposed'].includes(status)) return 'pill--pending'
  if (['paid_pending_start', 'scheduled', 'payment_authorized', 'in_progress', 'awaiting_customer_payment', 'completion_pending_customer'].includes(status)) return 'pill--active'
  if (status === 'completed') return 'pill--completed'
  return 'pill--cancelled'
}

function rebook(booking: BookingWithCleaner) {
  if (booking.cleaner_id) {
    router.push({ name: 'RequestBooking', query: { cleanerId: booking.cleaner_id } })
  } else {
    router.push({ name: 'BookCleaner' })
  }
}
</script>

<style scoped>
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

.page-main {
  padding-top: 2rem;
  padding-bottom: 4rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  padding: 0.5rem 2rem;
  border-radius: var(--radius);
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em !important;
  text-decoration: none;
  background: #000000;
  color: #ffffff;
  border: 1px solid #000000;
  transition: opacity 200ms ease;
}

.button-secondary:hover {
  opacity: 0.85;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

.main-col {
  width: 100%;
  min-width: 0;
}

@media (min-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr 20rem;
    align-items: start;
  }

  .main-col {
    width: auto;
  }

  .sidebar {
    position: sticky;
    top: 1.5rem;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
}

.booking-count-badge {
  background: var(--surface-container, #eeeeee);
  color: var(--on-surface-variant, #444748);
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-family: var(--font-caption);
  font-size: 12px;
}

/* ── Loading / Empty ── */
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
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

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

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
}

.empty-copy {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.empty-link {
  color: var(--primary, #000000);
  text-decoration: underline;
}

/* ── Bookings list ── */
.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 0.25rem;
  transition: border-color 200ms ease;
}

.booking-card:hover {
  border-color: var(--primary, #000000);
}

.booking-inner {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.booking-media {
  width: 100%;
  height: 8rem;
  flex-shrink: 0;
}

.booking-img-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface-container, #eeeeee);
  border-radius: 0.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 2rem;
  color: var(--secondary, #5e5e5e);
}

.booking-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.booking-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.booking-title {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.booking-provider {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

.booking-price {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
}

.booking-meta {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
}

.booking-meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--secondary, #5e5e5e);
}

.booking-meta-icon {
  font-size: 0.875rem;
}

.booking-meta-text {
  font-family: var(--font-caption);
  font-size: 12px;
}

.status-inline {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.booking-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.125rem;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 200ms ease;
}

.btn-icon:hover {
  background: var(--surface-container, #eeeeee);
}

.btn-icon--danger {
  color: var(--error, #ba1a1a);
}
.btn-icon--success {
  color: #2e7d32;
}

/* ── Sidebar ── */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.overview-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 0.25rem;
}

.overview-title {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 1rem;
}

.overview-rows {
  display: flex;
  flex-direction: column;
}

.overview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.overview-row--last {
  border-bottom: none;
}

.overview-label {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.overview-value {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
}

/* ── Past Bookings ── */
.past-section {
  margin-top: 6rem;
}

.past-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.past-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: color 200ms ease;
}

.view-all-btn:hover {
  color: var(--primary, #000000);
}

.view-all-icon {
  font-size: 0.875rem;
}

.empty-past {
  padding: 2rem 0;
}
.empty-past-text {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
}

.past-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.past-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 1.5rem;
  background: #ffffff;
  transition: border-color 200ms ease;
}

.past-card:hover {
  border-color: #a1a1aa;
}

.past-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.past-date {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.past-name {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 0.125rem;
  letter-spacing: 0.04em;
}

.cleaner-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.cleaner-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--surface-container, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.cleaner-avatar-icon {
  font-size: 0.875rem;
}

.cleaner-name {
  font-family: var(--font-caption);
  font-size: 12px;
}

.past-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-container, #eeeeee);
}

.past-price {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
}

.rebook-btn {
  font-family: var(--font-caption);
  font-size: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  color: var(--primary, #000000);
}

.rebook-btn:hover {
  text-decoration: none;
}

.past-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.view-btn {
  font-family: var(--font-caption);
  font-size: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  color: var(--secondary, #5e5e5e);
}

.view-btn:hover {
  color: var(--primary, #000000);
}

/* ── Status colours ── */
.pill--pending {
  background: #fff8e1;
  color: #e65100;
  border: 1px solid #ffcc80;
}
.pill--active {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #90caf9;
}
.pill--completed {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}
.pill--cancelled {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

@media (min-width: 768px) {
  .header-title {
    font-size: 32px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--primary, #000000);
    margin-bottom: 0.5rem;
  }
  .booking-inner {
    flex-direction: row;
  }
  .booking-media {
    width: 8rem;
    height: 8rem;
  }
  .booking-actions {
    flex-direction: column;
  }
  .past-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
  .content-grid {
    grid-template-columns: 8fr 4fr;
    gap: 2rem;
  }
  .past-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
