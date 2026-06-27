<template>
  <main class="clnst-page-main customer-bookings-page">
    <section class="page-header">
      <div>
        <h1 class="header-title">My Bookings</h1>
        <p class="header-sub">Track your pending, confirmed and completed bookings.</p>
      </div>
    </section>

    <div class="stats-row">
      <div class="stat-tile">
        <p class="stat-label">Pending Approval</p>
        <p class="stat-value">{{ bookingTotals.pending }}</p>
      </div>
      <div class="stat-tile">
        <p class="stat-label">Upcoming</p>
        <p class="stat-value">{{ bookingTotals.accepted }}</p>
      </div>
      <div class="stat-tile">
        <p class="stat-label">Completed</p>
        <p class="stat-value">{{ bookingTotals.completed }}</p>
      </div>
    </div>

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

    <p v-if="list.error.value" class="error-msg">{{ list.error.value }}</p>

    <div v-if="list.loading.value" class="clnst-loading-state">
      <div class="clnst-loading-spinner"></div>
      <p class="clnst-loading-text">Loading your bookings…</p>
    </div>

    <div v-else-if="list.bookings.value.length === 0" class="clnst-empty-state clnst-empty-state--spacious">
      <span class="material-symbols-outlined clnst-empty-icon">event_busy</span>
      <p class="clnst-empty-label">No bookings found</p>
      <p class="clnst-empty-desc clnst-empty-desc--spacious">
        <template v-if="list.currentTab.value === 'all'">
          When you book a cleaner, it will appear here.
        </template>
        <template v-else-if="list.currentTab.value === 'upcoming'">
          No upcoming bookings. Ready to schedule your next clean?
        </template>
        <template v-else-if="list.currentTab.value === 'past'">
          Your completed bookings will appear here once a cleaning is finished.
        </template>
        <template v-else-if="list.currentTab.value === 'cancelled'">
          No cancelled bookings — great news!
        </template>
        <template v-else>
          No bookings in this category yet.
        </template>
      </p>
      <router-link
        v-if="list.currentTab.value === 'all'"
        class="btn-primary"
        :to="{ name: 'BookCleaner' }"
      >+ Book a Cleaner</router-link>
    </div>

    <div v-else class="booking-list">
      <article v-for="b in list.bookings.value" :key="b.id" class="booking-card">
        <div class="card-top">
          <div class="card-info">
            <h3 class="card-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
            <p class="card-booking-id">#{{ b.id.slice(0, 8).toUpperCase() }}</p>
            <div class="card-meta">
              <span class="meta-item">
                <span class="material-symbols-outlined meta-icon">calendar_today</span>
                {{ formatDate(b.scheduled_start) }}
              </span>
              <span class="meta-item">
                <span class="material-symbols-outlined meta-icon">location_on</span>
                {{ b.location_text }}
              </span>
            </div>
          </div>
          <span class="clnst-status-pill" :class="getStatusPillClass(b.status)">{{
            getBookingStatusLabel(b, 'customer')
          }}</span>
        </div>
        <div class="card-actions">
          <router-link
            :to="{ name: 'CustomerBookingDetails', params: { bookingId: b.id } }"
            class="btn-outline"
          >
            View Booking
          </router-link>
          <button
            v-if="showPayButton(b)"
            type="button"
            class="btn-primary-sm"
            @click="openPayModal(b)"
          >
            Pay Additional {{ b.additional_payment_cents ? formatPence(b.additional_payment_cents) : '' }}
          </button>
          <button
            v-if="canCancel(b.status)"
            class="btn-danger"
            type="button"
            @click="handleCancelBooking(b.id)"
          >
            Cancel
          </button>
          <button
            v-if="canConfirmComplete(b.status)"
            class="btn-success"
            type="button"
            @click="handleConfirmComplete(b.id)"
          >
            Confirm Complete
          </button>
          <button
            v-if="b.status === 'completed' && !reviewedIds.has(b.id)"
            class="btn-outline"
            type="button"
            @click="openReview(b.id)"
          >
            Leave a Review
          </button>
        </div>
      </article>
    </div>

    <!-- Pagination -->
    <div
      v-if="!list.loading.value && list.totalCount.value > 0"
      class="clnst-pagination"
    >
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

    <!-- Payment modal -->
    <div v-if="payingBooking" class="modal-backdrop" @click.self="closePayModal">
      <div class="modal-box">
        <template v-if="!paySuccess">
          <div class="modal-header">
            <h2 class="modal-title">Additional Payment</h2>
            <button
              class="modal-close"
              type="button"
              :disabled="payProcessing"
              @click="closePayModal"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="pay-row">
              <span class="pay-label">Service</span>
              <span class="pay-val">{{
                payingBooking.service_title_snapshot ?? 'Cleaning Booking'
              }}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">Cleaner</span>
              <span class="pay-val">{{ payingBooking.cleaner_name ?? '—' }}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">Original Paid</span>
              <span class="pay-val">{{
                payingBooking.quote_cents
                  ? formatPence(payingBooking.quote_cents)
                  : '—'
              }}</span>
            </div>
            <div class="pay-row pay-row--total">
              <span class="pay-label">Additional Due</span>
              <span class="pay-val pay-amount">{{
                payingBooking.additional_payment_cents
                  ? formatPence(payingBooking.additional_payment_cents)
                  : '—'
              }}</span>
            </div>
            <p v-if="payError" class="pay-error">{{ payError }}</p>
            <div class="modal-actions">
              <button
                class="btn-pay-confirm"
                type="button"
                :disabled="payProcessing"
                @click="confirmPayment"
              >
                <span v-if="payProcessing" class="btn-spinner"></span>
                <span v-else>Confirm Payment</span>
              </button>
              <button
                class="btn-pay-cancel"
                type="button"
                :disabled="payProcessing"
                @click="closePayModal"
              >
                Cancel
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="modal-success">
            <span class="material-symbols-outlined success-check">check_circle</span>
            <p class="success-title">Payment Successful</p>
            <button class="btn-pay-confirm" type="button" @click="closePayModal">Done</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Review modal -->
    <div v-if="reviewingBookingId" class="modal-backdrop" @click.self="closeReview">
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="modal-title">Leave a Review</h2>
          <button class="modal-close" type="button" @click="closeReview">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="star-row" role="radiogroup" aria-label="Rating">
            <button
              v-for="n in 5"
              :key="n"
              class="star-btn"
              type="button"
              role="radio"
              :aria-checked="reviewRating === n"
              :aria-label="`${n} star${n === 1 ? '' : 's'}`"
              @click="reviewRating = n"
            >
              <span class="material-symbols-outlined" aria-hidden="true">{{
                n <= reviewRating ? 'star' : 'star_border'
              }}</span>
            </button>
          </div>
          <textarea
            v-model="reviewComment"
            class="review-textarea"
            rows="3"
            placeholder="Share your experience (optional)..."
          ></textarea>
          <p v-if="reviewError" class="review-error">{{ reviewError }}</p>
          <div class="modal-actions">
            <button
              class="btn-primary modal-btn"
              type="button"
              :disabled="reviewSubmitting"
              @click="submitReview"
            >
              {{ reviewSubmitting ? 'Submitting…' : 'Submit Review' }}
            </button>
            <button class="btn-cancel" type="button" @click="closeReview">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PropType } from 'vue'
import { createReview } from '@/services/reviewService'
import { startAdditionalPayment } from '@/services/payments/paymentOrchestrator'
import { formatPence, toUserMessage } from '@/utils/format'
import { getBookingStatusLabel, getStatusPillClass } from '@/utils/bookingStatusLabel'
import { useBookingList, BOOKING_TABS } from '@/composables/useBookingList'
import type { BookingListItem } from '@/composables/useBookingList'

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
  cancelBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
  confirmComplete: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
})

const list = useBookingList('customer')

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

async function handleCancelBooking(id: string) {
  await props.cancelBooking(id)
  await list.fetch()
}

async function handleConfirmComplete(id: string) {
  await props.confirmComplete(id)
  await list.fetch()
}

const reviewingBookingId = ref<string | null>(null)
const reviewRating = ref(5)
const reviewComment = ref('')
const reviewSubmitting = ref(false)
const reviewError = ref('')
const reviewedIds = ref<Set<string>>(new Set())

// Payment modal state
const payingBooking = ref<BookingListItem | null>(null)
const payProcessing = ref(false)
const paySuccess = ref(false)
const payError = ref('')
const optimisticPaidIds = ref(new Set<string>())

function showPayButton(b: BookingListItem): boolean {
  return b.requires_additional_payment && !optimisticPaidIds.value.has(b.id)
}

function openPayModal(b: BookingListItem) {
  if (optimisticPaidIds.value.has(b.id)) return
  payingBooking.value = b
  payProcessing.value = false
  paySuccess.value = false
  payError.value = ''
}

function closePayModal() {
  if (payProcessing.value) return
  payingBooking.value = null
  paySuccess.value = false
  payError.value = ''
}

async function confirmPayment() {
  if (!payingBooking.value || payProcessing.value) return
  const bookingId = payingBooking.value.id
  payProcessing.value = true
  payError.value = ''
  try {
    const result = await startAdditionalPayment(bookingId)
    if (result.redirectUrl) {
      // Stripe Checkout — navigate away; success page handles confirmation
      window.location.href = result.redirectUrl
      return
    }
    optimisticPaidIds.value = new Set([...optimisticPaidIds.value, bookingId])
    paySuccess.value = true
    await list.fetch()
  } catch (e) {
    payError.value = toUserMessage(e, 'Payment failed. Please try again.')
  } finally {
    payProcessing.value = false
  }
}

function openReview(bookingId: string) {
  reviewingBookingId.value = bookingId
  reviewRating.value = 5
  reviewComment.value = ''
  reviewError.value = ''
}

function closeReview() {
  reviewingBookingId.value = null
}

async function submitReview() {
  if (!reviewingBookingId.value) return
  reviewSubmitting.value = true
  reviewError.value = ''
  try {
    await createReview(
      reviewingBookingId.value,
      reviewRating.value,
      reviewComment.value || undefined,
    )
    reviewedIds.value = new Set([...reviewedIds.value, reviewingBookingId.value])
    closeReview()
  } catch (e) {
    reviewError.value = toUserMessage(e, 'Failed to submit your review. Please try again.')
  } finally {
    reviewSubmitting.value = false
  }
}

function canCancel(status: string): boolean {
  return ['pending_request', 'accepted', 'estimate_proposed'].includes(status)
}

function canConfirmComplete(status: string): boolean {
  return status === 'completion_pending_customer'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
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

.customer-bookings-page {
  padding-bottom: 6rem;
}

.page-header {
  margin-bottom: 2rem;
}

.header-title {
  font-family: var(--font-h2);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.25rem;
}

.header-sub {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Stats ── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-tile {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  padding: 1.25rem 1.5rem;
  border-radius: 0.25rem;
}

.stat-label {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.5rem;
}

.stat-value {
  font-family: var(--font-h2);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--on-surface, #1a1c1c);
  margin: 0;
}

/* ── Error ── */
.error-msg {
  color: var(--error, #ba1a1a);
  font-family: var(--font-body);
  font-size: 14px;
  margin-bottom: 1rem;
}

/* ── Booking list ── */
.booking-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  border-radius: 0.25rem;
  padding: 1.25rem 1.5rem;
  transition: border-color 200ms ease;
}

.booking-card:hover {
  border-color: var(--primary, #000000);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.card-info {
  flex: 1;
}

.card-title {
  font-family: var(--font-label-md);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.125rem;
}

.card-booking-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.5rem;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.meta-icon {
  font-size: 0.875rem;
}


/* ── Card actions ── */
.card-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-container, #eeeeee);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}


/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.5rem;
  background: #000000;
  color: #ffffff;
  border: 1px solid #000000;
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 200ms ease;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-primary-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  background: var(--primary, #000000);
  color: #ffffff;
  border: 1px solid var(--primary, #000000);
  border-radius: var(--radius, 0.25rem);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 200ms ease;
}

.btn-primary-sm:hover {
  opacity: 0.85;
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--error, #ba1a1a);
  border: 1px solid var(--error, #ba1a1a);
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.btn-danger:hover {
  background: #ffebee;
}

.btn-success {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  background: transparent;
  color: #2e7d32;
  border: 1px solid #2e7d32;
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.btn-success:hover {
  background: #e8f5e9;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--on-surface, #1a1c1c);
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 200ms ease;
  text-decoration: none;
}

.btn-outline:hover {
  background: var(--surface-container, #eeeeee);
}

/* ── Review modal ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-box {
  background: #ffffff;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 28rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.modal-title {
  font-family: var(--font-h2);
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
  padding: 0;
}

.modal-body {
  padding: 1.5rem;
}

.star-row {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.star-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.125rem;
  color: #f59e0b;
  display: flex;
}

.star-btn .material-symbols-outlined {
  font-size: 2rem;
}

.review-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  font-family: var(--font-body);
  font-size: 14px;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 0.5rem;
}

.review-textarea:focus {
  border-color: var(--primary, #000000);
}

.review-error {
  color: var(--error, #ba1a1a);
  font-size: 13px;
  margin: 0 0 0.75rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.modal-btn {
  flex: 1;
}

.btn-cancel {
  flex: 1;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-label-md);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.btn-cancel:hover {
  background: var(--surface-container, #eeeeee);
}

/* ── Payment modal ── */
.pay-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.pay-row--total {
  border-bottom: none;
  padding-top: 0.875rem;
  margin-top: 0.25rem;
}

.pay-label {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
}
.pay-val {
  font-size: 13px;
  font-weight: 500;
}
.pay-amount {
  font-size: 20px;
  font-weight: 700;
}

.pay-error {
  color: var(--error, #ba1a1a);
  font-size: 13px;
  margin: 0.75rem 0 0;
}

.btn-pay-confirm {
  flex: 1;
  padding: 0.625rem 1.25rem;
  background: var(--primary, #000000);
  color: #ffffff;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: opacity 0.15s;
}

.btn-pay-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-pay-cancel {
  flex: 1;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-pay-cancel:hover {
  background: var(--surface-container, #eeeeee);
}
.btn-pay-cancel:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1.5rem;
  gap: 1rem;
  text-align: center;
}

.success-check {
  font-size: 3rem;
  color: #2e7d32;
}
.success-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
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

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .card-top {
    flex-direction: column;
  }
}

</style>
