<template>
  <main class="page-main">
    <p v-if="props.errorMessage" class="error-msg">{{ props.errorMessage }}</p>

    <section class="page-header">
      <div>
        <h1 class="header-title">Welcome back, {{ auth.profile?.full_name ?? 'Cleaner' }}</h1>
        <p class="header-copy">
          You have {{ props.bookingTotals.pending + props.bookingTotals.accepted }} upcoming
          bookings.
        </p>
      </div>
      <div class="availability-card">
        <span class="availability-label">Availability Status</span>
        <button
          :aria-checked="props.isAvailable"
          :class="['availability-toggle', props.isAvailable ? 'availability-toggle--on' : '']"
          role="switch"
          :disabled="props.toggleLoading"
          @click="props.toggleAvailability()"
        >
          <span
            aria-hidden="true"
            :class="[
              'availability-toggle__thumb',
              props.isAvailable ? 'availability-toggle__thumb--on' : '',
            ]"
          ></span>
        </button>
        <span
          :class="[
            'availability-badge',
            props.isAvailable ? 'availability-badge--active' : 'availability-badge--inactive',
          ]"
        >
          {{ props.isAvailable ? 'Active' : 'Inactive' }}
        </span>
      </div>
    </section>

    <section class="earnings-grid">
      <div class="earnings-card">
        <div>
          <span class="metric-label">Total Earnings (This Month)</span>
          <h2 class="metric-value-xl">{{ props.earningsToDate }}</h2>
        </div>
        <div class="metric-footer">
          <span class="metric-footer-text">Based on completed jobs</span>
          <router-link :to="{ name: 'CleanerFinancials' }" class="report-btn">
            View Report <span class="material-symbols-outlined">arrow_forward</span>
          </router-link>
        </div>
      </div>

      <div class="metric-card">
        <div>
          <span class="metric-label">Rating</span>
          <div class="rating-row">
            <h2 class="metric-value">{{ props.ratingLabel }}</h2>
            <span class="material-symbols-outlined star-icon">star</span>
          </div>
        </div>
        <p class="metric-sub">Based on reviews</p>
      </div>

      <div class="metric-card">
        <div>
          <span class="metric-label">Completed</span>
          <h2 class="metric-value">{{ props.bookingTotals.completed }}</h2>
        </div>
        <p class="metric-sub">Jobs this month</p>
      </div>
    </section>

    <BookingCarousel
      :bookings="props.bookings"
      :loading="props.loading"
      :loading-id="props.actionLoadingId"
      @accept="props.acceptBooking"
      @decline="props.declineBooking"
      @start="props.startBooking"
      @end="props.markCompleted"
    />
  </main>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useAuthStore } from '@/stores/auth'
import BookingCarousel from './BookingCarousel.vue'

interface BookingEntry {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: string
  quote_cents?: number | null
  customer?: { id: string; full_name: string; avatar_url: string | null } | null
}

const auth = useAuthStore()

const props = defineProps({
  earningsToDate: { type: String, default: '—' },
  bookingTotals: {
    type: Object as PropType<{ pending: number; accepted: number; completed: number }>,
    default: () => ({ pending: 0, accepted: 0, completed: 0 }),
  },
  ratingLabel: { type: String, default: 'No rating yet' },
  errorMessage: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  bookings: { type: Array as PropType<BookingEntry[]>, default: () => [] },
  actionLoadingId: { type: String as PropType<string | null>, default: null },
  isAvailable: { type: Boolean, default: true },
  toggleLoading: { type: Boolean, default: false },
  toggleAvailability: {
    type: Function as PropType<() => Promise<void>>,
    default: () => Promise.resolve(),
  },
  startBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => Promise.resolve(),
  },
  markCompleted: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => Promise.resolve(),
  },
  acceptBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => Promise.resolve(),
  },
  declineBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => Promise.resolve(),
  },
})
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
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  min-height: 100vh;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

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

.page-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 3rem;
  gap: 1rem;
}

@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    align-items: flex-end;
  }
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
  color: var(--secondary, #5e5e5e);
}

.availability-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: #ffffff;
  padding: 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
}

.availability-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
}

.availability-toggle {
  position: relative;
  display: inline-flex;
  height: 1.5rem;
  width: 2.75rem;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 9999px;
  border: 2px solid transparent;
  transition: background-color 0.2s;
  background-color: var(--outline-variant, #c4c7c7);
  outline: none;
}

.availability-toggle--on {
  background-color: var(--primary, #000000);
}
.availability-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.availability-toggle__thumb {
  pointer-events: none;
  display: inline-block;
  height: 1.25rem;
  width: 1.25rem;
  transform: translateX(0);
  border-radius: 9999px;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease-in-out;
}

.availability-toggle__thumb--on {
  transform: translateX(1.25rem);
}

.availability-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 0.25rem;
  padding: 0.125rem 0.5rem;
}

.availability-badge--active {
  color: var(--primary, #000000);
  background-color: var(--surface-container, #eeeeee);
}

.availability-badge--inactive {
  color: var(--secondary, #5e5e5e);
  background-color: var(--surface-container, #eeeeee);
}

.earnings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 4rem;
}

@media (min-width: 768px) {
  .earnings-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.earnings-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

@media (min-width: 768px) {
  .earnings-card {
    grid-column: span 2;
  }
}

.metric-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
}

.metric-value-xl {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-top: 0.5rem;
}

.metric-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-footer-text {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.report-btn {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}

.report-btn:hover {
  text-decoration: underline;
}

.metric-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--primary, #000000);
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.star-icon {
  color: var(--primary, #000000);
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.metric-sub {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .content-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.bookings-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
}

.section-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}

.section-link:hover {
  color: var(--primary, #000000);
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

/* ── Booking cards ── */
.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-card {
  padding: 1.5rem;
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  transition: border-color 0.15s;
}

.booking-card:hover {
  border-color: var(--primary, #000000);
}

.booking-media {
  width: 100%;
  height: 8rem;
  background-color: var(--surface-container, #eeeeee);
  flex-shrink: 0;
  overflow: hidden;
}

.booking-img-placeholder {
  width: 100%;
  height: 100%;
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
}

.booking-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.booking-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary, #000000);
  margin-bottom: 0.25rem;
}

.booking-address {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

.booking-time-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background-color: var(--surface-container, #eeeeee);
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
}

.booking-meta {
  margin-top: 1rem;
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
  color: var(--secondary, #5e5e5e);
}

.booking-meta-item .material-symbols-outlined {
  font-size: 1rem;
}

.booking-ctas {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  justify-content: flex-end;
}

@media (min-width: 768px) {
  .booking-ctas {
    align-items: stretch;
  }
}

.btn-start {
  padding: 0.5rem 1rem;
  background-color: var(--primary, #000000);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  text-align: center;
}

.btn-action {
  padding: 0.5rem 1rem;
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

.btn-action:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

/* ── Incoming bookings column ── */
.route-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
