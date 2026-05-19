<template>
  <main class="page-main">
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

    <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading your bookings…</p>
    </div>

    <div v-else-if="bookings.length === 0" class="empty-state">
      <span class="material-symbols-outlined empty-icon">event_busy</span>
      <p class="empty-title">No bookings yet</p>
      <p class="empty-copy">When you book a cleaner, it will appear here.</p>
      <router-link class="btn-primary" :to="{ name: 'BookCleaner' }">+ Book a Cleaner</router-link>
    </div>

    <div v-else class="booking-list">
      <article v-for="b in bookings" :key="b.id" class="booking-card">
        <div class="card-top">
          <div class="card-info">
            <h3 class="card-title">{{ b.service_title_snapshot ?? 'Cleaning Booking' }}</h3>
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
          <span class="status-pill" :class="statusClass(b.status)">{{
            getBookingDisplayStatus(b, 'customer')
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
            Make Payment
          </button>
          <button
            v-if="canCancel(b.status)"
            class="btn-danger"
            type="button"
            @click="props.cancelBooking(b.id)"
          >
            Cancel
          </button>
          <button
            v-if="canConfirmComplete(b.status)"
            class="btn-success"
            type="button"
            @click="props.confirmComplete(b.id)"
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

    <!-- Payment modal -->
    <div v-if="payingBooking" class="modal-backdrop" @click.self="closePayModal">
      <div class="modal-box">
        <template v-if="!paySuccess">
          <div class="modal-header">
            <h2 class="modal-title">Booking Payment</h2>
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
            <div class="pay-row pay-row--total">
              <span class="pay-label">Amount</span>
              <span class="pay-val pay-amount">{{
                payingBooking.quote_cents ? formatPence(payingBooking.quote_cents) : '—'
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
          <div class="star-row">
            <button
              v-for="n in 5"
              :key="n"
              class="star-btn"
              type="button"
              @click="reviewRating = n"
            >
              <span class="material-symbols-outlined">{{
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
import { ref } from 'vue'
import type { PropType } from 'vue'
import { createReview } from '@/services/reviewService'
import { processBookingPayment } from '@/services/bookingService'
import { formatPence } from '@/utils/format'
import { getBookingDisplayStatus, isCustomerPaymentRequired } from '@/utils/bookingStatus'

interface BookingSummary {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: string
  payment_status?: string | null
  quote_cents?: number | null
  cleaner_name?: string | null
}

interface BookingTotals {
  pending: number
  accepted: number
  completed: number
}

const props = defineProps({
  bookings: { type: Array as PropType<BookingSummary[]>, default: () => [] },
  bookingTotals: {
    type: Object as PropType<BookingTotals>,
    default: () => ({ pending: 0, accepted: 0, completed: 0 }),
  },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  cancelBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
  confirmComplete: {
    type: Function as PropType<(id: string) => Promise<void>>,
    default: () => {},
  },
})

const reviewingBookingId = ref<string | null>(null)
const reviewRating = ref(5)
const reviewComment = ref('')
const reviewSubmitting = ref(false)
const reviewError = ref('')
const reviewedIds = ref<Set<string>>(new Set())

// Payment modal state
const payingBooking = ref<BookingSummary | null>(null)
const payProcessing = ref(false)
const paySuccess = ref(false)
const payError = ref('')
const optimisticPaidIds = ref(new Set<string>())

function showPayButton(b: BookingSummary): boolean {
  return isCustomerPaymentRequired(b) && !optimisticPaidIds.value.has(b.id)
}

function openPayModal(b: BookingSummary) {
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
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await processBookingPayment(bookingId)
    optimisticPaidIds.value = new Set([...optimisticPaidIds.value, bookingId])
    paySuccess.value = true
  } catch (e) {
    payError.value = e instanceof Error ? e.message : 'Payment failed. Please try again.'
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
    reviewError.value = e instanceof Error ? e.message : 'Failed to submit review.'
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
  if (Number.isNaN(date.valueOf())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusClass(status: string): string {
  if (['pending_request', 'accepted', 'estimate_proposed'].includes(status))
    return 'status-pill--pending'
  if (
    [
      'paid_pending_start',
      'scheduled',
      'awaiting_customer_payment',
      'payment_authorized',
      'in_progress',
      'completion_pending_customer',
    ].includes(status)
  )
    return 'status-pill--active'
  if (status === 'completed') return 'status-pill--completed'
  if (['cancelled', 'declined', 'cleaner_declined', 'disputed', 'refunded'].includes(status))
    return 'status-pill--cancelled'
  return ''
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
  padding: 2rem 1.5rem 6rem;
  max-width: 80rem;
  margin: 0 auto;
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

/* ── Loading ── */
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
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Empty state ── */
.empty-state {
  border: 1px dashed var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: var(--outline-variant, #c4c7c7);
  display: block;
  margin: 0 auto 1rem;
}

.empty-title {
  font-family: var(--font-label-md);
  font-size: 18px;
  font-weight: 500;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.5rem;
}

.empty-copy {
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 1.5rem;
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

/* ── Status pills ── */
.status-pill {
  border-radius: 999px;
  padding: 0.25rem 0.625rem;
  font-family: var(--font-caption);
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .card-top {
    flex-direction: column;
  }
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}
</style>
