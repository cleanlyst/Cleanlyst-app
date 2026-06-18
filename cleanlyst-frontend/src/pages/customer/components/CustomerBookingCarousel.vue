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
        <router-link :to="{ name: 'BookCleaner' }" class="empty-link">Book Cleaner</router-link>
        to get started.
      </p>
    </div>

    <div v-else class="carousel-viewport" aria-live="polite">
      <div class="carousel-track" :style="{ transform: `translateX(-${currentIdx * 100}%)` }">
        <div v-for="b in slides" :key="b.id" class="carousel-slide">
          <div class="booking-card">
            <div class="booking-media">
              <span class="material-symbols-outlined media-icon">cleaning_services</span>
            </div>

            <div class="booking-body">
              <div class="booking-title-row">
                <div class="booking-title-wrap">
                  <h3 class="booking-title">
                    {{ b.service_title_snapshot ?? 'Cleaning Booking' }}
                  </h3>
                  <p class="booking-provider">{{ b.cleaner_name ?? 'Your cleaner' }}</p>
                </div>
                <span :class="['status-pill', statusClass(b.status)]">
                  {{ getBookingStatusLabel(b, 'customer') }}
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

              <div
                v-if="b.status === 'accepted' && b.payment_status !== 'captured'"
                class="action-banner action-banner--pay"
              >
                <span class="material-symbols-outlined">payments</span>
                Your booking has been accepted.
              </div>

              <div
                v-if="
                  b.status === 'paid_pending_start' ||
                  (b.status === 'accepted' && b.payment_status === 'captured')
                "
                class="action-banner action-banner--info"
              >
                <span class="material-symbols-outlined">check_circle</span>
                Payment confirmed — awaiting cleaner start.
              </div>

              <div v-if="b.status === 'in_progress'" class="action-banner action-banner--active">
                <span class="material-symbols-outlined">cleaning_services</span>
                Cleaner has started cleaning.
              </div>

              <div v-if="b.status === 'cleaner_no_show'" class="action-banner action-banner--info">
                <span class="material-symbols-outlined">person_search</span>
                Replacement cleaner requested
              </div>

              <!-- Legacy: bookings requiring explicit customer confirmation -->
              <div v-if="b.status === 'completion_pending_customer'" class="action-banner">
                <span class="material-symbols-outlined">check_circle</span>
                Your cleaner has finished — please confirm completion.
              </div>
            </div>

            <div class="booking-ctas">
              <button
                v-if="showPayButton(b)"
                type="button"
                class="btn-primary"
                @click="openPayModal(b)"
              >
                Make Payment
              </button>
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PropType } from 'vue'
import { formatDate, formatPence } from '@/utils/format'
import { isCustomerPaymentRequired, getBookingStatusLabel } from '@/utils/bookingStatusLabel'
import { recordAdditionalPayment } from '@/services/bookingService'

interface CarouselBooking {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: string
  payment_status?: string | null
  quote_cents?: number | null
  cleaner_name?: string | null
}

const UPCOMING_STATUSES = [
  'pending_request',
  'accepted',
  'paid_pending_start',
  'estimate_proposed',
  'awaiting_customer_payment',
  'payment_authorized',
  'in_progress',
  'completion_pending_customer',
  'cleaner_no_show',
]

const props = defineProps({
  bookings: { type: Array as PropType<CarouselBooking[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingId: { type: String as PropType<string | null>, default: null },
})

const emit = defineEmits<{
  (e: 'confirmComplete', id: string): void
  (e: 'paymentDone', id: string): void
}>()

const currentIdx = ref(0)

// Payment modal state
const payingBooking = ref<CarouselBooking | null>(null)
const payProcessing = ref(false)
const paySuccess = ref(false)
const payError = ref('')
const optimisticPaidIds = ref(new Set<string>())

function showPayButton(b: CarouselBooking): boolean {
  return isCustomerPaymentRequired(b) && !optimisticPaidIds.value.has(b.id)
}

function openPayModal(b: CarouselBooking) {
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
    await recordAdditionalPayment(bookingId)
    optimisticPaidIds.value = new Set([...optimisticPaidIds.value, bookingId])
    paySuccess.value = true
    emit('paymentDone', bookingId)
  } catch (e) {
    payError.value = e instanceof Error ? e.message : 'Payment failed. Please try again.'
  } finally {
    payProcessing.value = false
  }
}

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

function statusClass(status: string): string {
  if (status === 'completion_pending_customer') return 'pill--warning'
  if (status === 'accepted') return 'pill--warning'
  if (
    ['paid_pending_start', 'scheduled', 'payment_authorized', 'in_progress', 'cleaner_no_show'].includes(
      status,
    )
  )
    return 'pill--active'
  if (['pending_request', 'estimate_proposed'].includes(status)) return 'pill--pending'
  return 'pill--default'
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
  background: var(--surface-container, #eeeeee);
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
.empty-link {
  color: var(--primary, #000000);
  text-decoration: underline;
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

.media-icon {
  font-size: 2.5rem;
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
.pill--warning {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc02;
}
.pill--default {
  background: var(--surface-container, #eeeeee);
  color: var(--secondary, #5e5e5e);
}

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

.booking-meta-item .material-symbols-outlined {
  font-size: 1rem;
}

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

.action-banner .material-symbols-outlined {
  font-size: 1rem;
}

.action-banner--pay {
  color: #1565c0;
  background: #e3f2fd;
  border: 1px solid #90caf9;
}

.action-banner--info {
  color: #2e7d32;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
}

.action-banner--active {
  color: #1565c0;
  background: #e3f2fd;
  border: 1px solid #90caf9;
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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

.btn-outline:hover {
  background: var(--surface-variant, #e2e2e2);
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

/* ── Payment modal ── */
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
  width: 100%;
  max-width: 24rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.modal-title {
  font-size: 18px;
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

.modal-close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

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

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
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
</style>
