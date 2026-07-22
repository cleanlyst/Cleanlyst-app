<template>
  <main class="admin-booking-detail clnst-page-main">
    <router-link :to="{ name: 'BookingManagement' }" class="back-link">
      <span class="material-symbols-outlined">arrow_back</span>
      Booking Management
    </router-link>

    <p v-if="errorMessage" class="clnst-error-msg">{{ errorMessage }}</p>

    <div v-if="loading && !booking" class="clnst-loading-state">
      <div class="clnst-loading-spinner"></div>
      <p class="clnst-loading-text">Loading booking...</p>
    </div>

    <section v-if="booking" class="detail-card">
      <header class="detail-header">
        <div>
          <p class="detail-kicker">Booking Details</p>
          <h1 class="clnst-header-title">
            {{ booking.service_title_snapshot ?? 'Cleaning Booking' }}
          </h1>
          <p class="clnst-header-copy">#{{ booking.id }}</p>
        </div>
        <div class="detail-header-actions">
          <span :class="['clnst-status-pill', getStatusPillClass(booking.status)]">
            {{ getBookingStatusLabel(booking, 'admin') }}
          </span>
          <button
            v-if="isReassignable(booking.status)"
            class="btn-reassign-detail"
            type="button"
            @click="openReassignModal(booking)"
          >
            <span class="material-symbols-outlined">person_search</span>
            Reassign Cleaner
          </button>
        </div>
      </header>

      <div class="detail-grid">
        <div class="detail-block">
          <span class="detail-label">Customer</span>
          <p class="detail-value">{{ booking.customer?.full_name ?? 'Unavailable' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Cleaner</span>
          <p class="detail-value">{{ booking.current_cleaner_name ?? booking.cleaner_id ?? 'Unassigned' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Schedule</span>
          <p class="detail-value">{{ formatDateTime(booking.scheduled_start) }}</p>
          <p class="detail-sub">{{ formatTimeRange(booking.scheduled_start, booking.scheduled_end) }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Payment</span>
          <p class="detail-value">{{ formatPaymentStatus(booking.payment_status) }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Location</span>
          <p class="detail-value">{{ booking.location_text || 'Unavailable' }}</p>
        </div>
        <div class="detail-block">
          <span class="detail-label">Quote</span>
          <p class="detail-value">{{ formatPence(booking.quote_cents, booking.currency ?? 'GBP') }}</p>
        </div>
      </div>

      <div class="detail-notes">
        <span class="detail-label">Notes</span>
        <p class="detail-value">{{ booking.notes || 'No notes provided.' }}</p>
      </div>

      <!-- Adjustment Details (estimate_adjustment_requested flow) -->
      <div v-if="booking.proposed_total_cents != null" class="reassignment-history" data-testid="adjustment-details">
        <h2 class="reassignment-history__title">Price Adjustment Details</h2>
        <div class="reassignment-grid">
          <div class="reassignment-block">
            <span class="detail-label">Proposed Total</span>
            <p class="detail-value">{{ formatPence(booking.proposed_total_cents ?? 0, booking.currency ?? 'GBP') }}</p>
          </div>
          <div class="reassignment-block">
            <span class="detail-label">Adjustment Amount</span>
            <p class="detail-value">{{ formatPence(booking.adjustment_amount_cents ?? 0, booking.currency ?? 'GBP') }}</p>
          </div>
          <div class="reassignment-block">
            <span class="detail-label">Requested At</span>
            <p class="detail-value">{{ booking.adjustment_requested_at ? formatDateTime(booking.adjustment_requested_at) : '—' }}</p>
          </div>
          <div class="reassignment-block">
            <span class="detail-label">Customer Response</span>
            <p class="detail-value">{{ booking.customer_adjustment_response_at ? formatDateTime(booking.customer_adjustment_response_at) : 'Pending' }}</p>
          </div>
        </div>
        <div v-if="booking.adjustment_reason" class="detail-notes" style="margin-top:0.75rem">
          <span class="detail-label">Reason</span>
          <p class="detail-value">"{{ booking.adjustment_reason }}"</p>
        </div>
      </div>

      <!-- Reassignment History -->
      <div v-if="booking.original_cleaner_id" class="reassignment-history">
        <h2 class="reassignment-history__title">Reassignment History</h2>
        <div class="reassignment-grid">
          <div class="reassignment-block">
            <span class="detail-label">Original Cleaner</span>
            <p class="detail-value">{{ booking.original_cleaner_name ?? booking.original_cleaner_id }}</p>
          </div>
          <div class="reassignment-block">
            <span class="detail-label">Replacement Cleaner</span>
            <p class="detail-value">{{ booking.current_cleaner_name ?? booking.cleaner_id ?? '—' }}</p>
          </div>
          <div class="reassignment-block">
            <span class="detail-label">Reassigned By</span>
            <p class="detail-value">{{ booking.reassigned_by_name ?? 'Admin' }}</p>
          </div>
          <div class="reassignment-block">
            <span class="detail-label">Date</span>
            <p class="detail-value">{{ booking.reassigned_at ? formatDateTime(booking.reassigned_at) : '—' }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Reassign Modal (3-step) -->
    <div v-if="showReassignModal" class="ra-backdrop" @click.self="closeReassignModal">
      <div class="ra-box">
        <!-- Header -->
        <div class="ra-header">
          <div>
            <p class="ra-step-label">Step {{ reassignStep }} of 3</p>
            <h2 class="ra-title">
              {{ reassignStep === 1 ? 'Select New Date & Time' : reassignStep === 2 ? 'Choose Cleaner' : 'Confirm Reassignment' }}
            </h2>
          </div>
          <button class="ra-close" type="button" aria-label="Close" @click="closeReassignModal">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="ra-body">
          <!-- Warning for in-progress bookings -->
          <div v-if="reassignTarget?.status === 'in_progress'" class="reassign-warning">
            <span class="material-symbols-outlined reassign-warning__icon">warning</span>
            <div>
              <p class="reassign-warning__title">This booking is currently in progress</p>
              <p class="reassign-warning__body">Reassigning may disrupt an active service. Confirm only if necessary.</p>
            </div>
          </div>

          <!-- ── Step 1: Date & Time ── -->
          <template v-if="reassignStep === 1">
            <div class="reassign-booking-info">
              <p class="reassign-label">Booking</p>
              <p class="reassign-value">{{ reassignTarget?.service_title_snapshot ?? 'Cleaning Booking' }}</p>
              <p class="reassign-sub">Current cleaner: {{ reassignTarget?.current_cleaner_name ?? 'Unassigned' }}</p>
            </div>
            <div class="ra-date-grid">
              <div>
                <label class="ra-field-label">New Cleaning Date</label>
                <input
                  v-model="reassignDate"
                  type="date"
                  :min="today"
                  class="ra-input"
                />
              </div>
              <div>
                <label class="ra-field-label">Start Time</label>
                <input
                  v-model="reassignTime"
                  type="time"
                  class="ra-input"
                />
              </div>
            </div>
          </template>

          <!-- ── Step 2: Cleaner Cards ── -->
          <template v-else-if="reassignStep === 2">
            <p class="reassign-sub" style="margin-bottom:1rem;">
              Available on {{ formatDate(reassignDate) }} at {{ reassignTime }}
            </p>
            <div v-if="cleanerSearchLoading" class="ra-loading">
              <div class="ra-spinner"></div>
              Searching available cleaners…
            </div>
            <div v-else-if="cleanerResults.length === 0" class="ra-empty">
              <span class="material-symbols-outlined" style="font-size:2.5rem;color:var(--outline-variant,#c4c7c7)">search_off</span>
              <p>No available cleaners found for this date.</p>
              <p style="font-size:12px;color:var(--secondary,#5e5e5e)">Try a different date or time.</p>
            </div>
            <div v-else class="ra-cleaner-grid">
              <div
                v-for="c in cleanerResults"
                :key="c.user_id"
                class="ra-cleaner-card"
              >
                <div class="ra-card-img-wrap">
                  <img
                    v-if="c.profiles?.avatar_url"
                    :src="c.profiles.avatar_url"
                    :alt="cleanerDisplayName(c)"
                    class="ra-card-img"
                  />
                  <div v-else class="ra-card-img-placeholder">
                    <span class="material-symbols-outlined" style="font-size:3rem;color:var(--on-surface-variant,#5e5e5e)">person</span>
                  </div>
                  <div v-if="c.average_rating >= 4.9" class="ra-top-badge">Top Rated</div>
                </div>
                <div class="ra-card-body">
                  <div class="ra-card-header">
                    <div>
                      <h3 class="ra-card-name">{{ cleanerDisplayName(c) }}</h3>
                      <div class="ra-card-rating">
                        <span class="material-symbols-outlined ra-star">star</span>
                        <span>{{ c.average_rating > 0 ? c.average_rating.toFixed(1) : '—' }}</span>
                        <span class="ra-review-count">({{ c.review_count }})</span>
                      </div>
                    </div>
                    <div class="ra-card-price">
                      <span>{{ estimatedPrice(c.user_id) }}</span>
                      <span class="ra-price-sub">est. total</span>
                    </div>
                  </div>
                  <p v-if="c.bio" class="ra-card-bio">{{ c.bio }}</p>
                  <div class="ra-card-footer">
                    <div class="ra-card-meta">
                      <div class="ra-card-service">
                        <span class="material-symbols-outlined" style="font-size:14px">cleaning_services</span>
                        {{ serviceTitle(c.user_id) }}
                      </div>
                      <div class="ra-card-avail">
                        <span class="material-symbols-outlined" style="font-size:14px">event_available</span>
                        Available {{ formatDate(reassignDate) }}
                      </div>
                    </div>
                    <button
                      class="ra-select-btn"
                      type="button"
                      @click="selectCleanerForReassign(c)"
                    >
                      Select Cleaner
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- ── Step 3: Confirm ── -->
          <template v-else-if="reassignStep === 3">
            <div class="reassign-booking-info">
              <p class="reassign-label">New Cleaner</p>
              <p class="reassign-value">{{ selectedCleaner ? cleanerDisplayName(selectedCleaner) : '—' }}</p>
              <p class="reassign-sub" v-if="selectedCleaner?.profiles?.city">{{ selectedCleaner.profiles.city }}</p>
              <div class="ra-card-rating" style="margin-top:0.25rem">
                <span class="material-symbols-outlined ra-star">star</span>
                <span>{{ selectedCleaner?.average_rating.toFixed(1) }}</span>
                <span class="ra-review-count">({{ selectedCleaner?.review_count }} reviews)</span>
              </div>
            </div>
            <div class="reassign-booking-info" style="margin-top:0.75rem">
              <p class="reassign-label">New Schedule</p>
              <p class="reassign-value">{{ formatDate(reassignDate) }} at {{ reassignTime }}</p>
              <p class="reassign-sub">Duration preserved from original booking</p>
            </div>
            <div class="reassign-booking-info" style="margin-top:0.75rem">
              <p class="reassign-label">Booking</p>
              <p class="reassign-value">{{ reassignTarget?.service_title_snapshot ?? 'Cleaning Booking' }}</p>
              <p class="reassign-sub">Previous cleaner: {{ reassignTarget?.current_cleaner_name ?? '—' }}</p>
            </div>
            <p v-if="reassignError" class="reassign-error" style="margin-top:0.75rem">{{ reassignError }}</p>
          </template>
        </div>

        <!-- Footer -->
        <div class="ra-footer">
          <button
            v-if="reassignStep === 1"
            class="btn-modal-cancel"
            type="button"
            @click="closeReassignModal"
          >Cancel</button>
          <button
            v-if="reassignStep > 1"
            class="btn-modal-cancel"
            type="button"
            :disabled="reassignLoading"
            @click="reassignStep = (reassignStep - 1) as 1 | 2 | 3"
          >← Back</button>

          <button
            v-if="reassignStep === 1"
            class="btn-modal-confirm"
            type="button"
            :disabled="!reassignDate || !reassignTime || cleanerSearchLoading"
            @click="goToStep2"
          >
            {{ cleanerSearchLoading ? 'Searching…' : 'Find Available Cleaners →' }}
          </button>
          <button
            v-if="reassignStep === 3"
            class="btn-modal-confirm"
            type="button"
            :disabled="!selectedCleaner || reassignLoading"
            @click="submitReassign"
          >
            {{ reassignLoading ? 'Reassigning…' : 'Confirm Reassignment' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getBookingById, reassignBooking, type BookingDetailRow } from '@/services/bookingService'
import { searchCleaners, type CleanerSearchResult } from '@/services/cleanerService'
import { formatDate, formatDateTime, formatPence, formatStatus, toUserMessage } from '@/utils/format'
import { getBookingStatusLabel, getStatusPillClass } from '@/utils/bookingStatusLabel'
import { requireSupabase } from '@/lib/supabase'

const REASSIGNABLE_STATUSES = new Set([
  'cleaner_no_show', 'accepted', 'in_progress', 'paid',
  'cleaner_cancelled', 'reassign_requested', 'pending_request',
  'estimate_adjustment_requested',
])

const today = new Date().toISOString().slice(0, 10)

const route = useRoute()
const booking = ref<BookingDetailRow | null>(null)
const loading = ref(false)
const errorMessage = ref('')

// Reassign modal state
const showReassignModal = ref(false)
const reassignTarget = ref<BookingDetailRow | null>(null)
const reassignStep = ref<1 | 2 | 3>(1)
const reassignDate = ref('')
const reassignTime = ref('09:00')
const cleanerResults = ref<CleanerSearchResult[]>([])
const cleanerSearchLoading = ref(false)
const cleanerSearched = ref(false)
const selectedCleaner = ref<CleanerSearchResult | null>(null)
const cleanerBasePrices = ref<Map<string, { price: number; title: string }>>(new Map())
const reassignLoading = ref(false)
const reassignError = ref('')

watch(
  () => route.params.bookingId,
  async (value) => {
    const bookingId = getRouteParam(value)
    if (!bookingId) {
      booking.value = null
      errorMessage.value = 'Booking no longer available'
      return
    }
    await loadBooking(bookingId)
  },
  { immediate: true },
)

async function loadBooking(bookingId: string) {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getBookingById(bookingId)
    if (!data) {
      booking.value = null
      errorMessage.value = 'Booking no longer available'
      return
    }
    booking.value = data
  } catch (error) {
    booking.value = null
    errorMessage.value = toUserMessage(error, 'Failed to load booking. Please try again.')
  } finally {
    loading.value = false
  }
}

function getRouteParam(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function isReassignable(status: string): boolean {
  return REASSIGNABLE_STATUSES.has(status)
}

function formatPaymentStatus(ps: string | null | undefined): string {
  switch (ps) {
    case 'captured': return 'Payment Received'
    case 'released': return 'Released to Cleaner'
    case 'refunded': return 'Refunded'
    case 'pending': return 'Pending'
    case 'failed': return 'Payment Failed'
    case 'authorized': return 'Authorized'
    default: return ps ? formatStatus(ps) : 'Unknown'
  }
}

function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return 'Duration TBC'
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.valueOf()) || Number.isNaN(e.valueOf())) return '-'
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${fmt.format(s)} - ${fmt.format(e)}`
}

function openReassignModal(b: BookingDetailRow) {
  reassignTarget.value = b
  reassignStep.value = 1
  reassignDate.value = b.scheduled_start?.slice(0, 10) ?? today
  reassignTime.value = b.scheduled_start?.slice(11, 16) ?? '09:00'
  cleanerResults.value = []
  cleanerSearched.value = false
  selectedCleaner.value = null
  cleanerBasePrices.value = new Map()
  reassignError.value = ''
  showReassignModal.value = true
}

function closeReassignModal() {
  showReassignModal.value = false
  reassignTarget.value = null
  cleanerResults.value = []
  selectedCleaner.value = null
  cleanerBasePrices.value = new Map()
  reassignError.value = ''
  reassignStep.value = 1
}

async function goToStep2() {
  if (!reassignDate.value || !reassignTime.value) return
  cleanerSearchLoading.value = true
  cleanerSearched.value = false
  cleanerResults.value = []
  cleanerBasePrices.value = new Map()
  reassignError.value = ''
  try {
    const results = await searchCleaners({
      availabilityDate: reassignDate.value,
      availabilityTime: reassignTime.value,
      serviceCategory: reassignTarget.value?.category_snapshot ?? undefined,
    })
    const currentCleanerId = reassignTarget.value?.cleaner_id
    cleanerResults.value = currentCleanerId
      ? results.filter((c) => c.user_id !== currentCleanerId)
      : results
    await loadCleanerPrices(cleanerResults.value.map((c) => c.user_id))
    cleanerSearched.value = true
    reassignStep.value = 2
  } catch {
    cleanerResults.value = []
    cleanerSearched.value = true
  } finally {
    cleanerSearchLoading.value = false
  }
}

async function loadCleanerPrices(cleanerIds: string[]) {
  if (!cleanerIds.length) return
  const category = reassignTarget.value?.category_snapshot ?? null
  const supabase = requireSupabase()
  const { data } = await supabase
    .from('services')
    .select('cleaner_id, title, category, base_price_cents')
    .in('cleaner_id', cleanerIds)
    .eq('active', true)

  const prices = new Map<string, { price: number; title: string }>()
  for (const svc of data ?? []) {
    const existing = prices.get(svc.cleaner_id)
    const isMatch = category && svc.category === category
    if (!existing || isMatch) {
      prices.set(svc.cleaner_id, { price: svc.base_price_cents, title: svc.title })
    }
  }
  cleanerBasePrices.value = prices
}

function estimatedPrice(cleanerId: string): string {
  const d = cleanerBasePrices.value.get(cleanerId)
  if (!d || !d.price) return '—'
  return `From ${formatPence(d.price, 'GBP')}`
}

function serviceTitle(cleanerId: string): string {
  return cleanerBasePrices.value.get(cleanerId)?.title
    ?? reassignTarget.value?.service_title_snapshot
    ?? 'Cleaning Service'
}

function cleanerDisplayName(c: CleanerSearchResult): string {
  return c.business_name ?? c.profiles?.full_name ?? 'Cleaner'
}

function selectCleanerForReassign(c: CleanerSearchResult) {
  selectedCleaner.value = c
  reassignStep.value = 3
}

async function submitReassign() {
  if (!selectedCleaner.value || !reassignTarget.value) return
  reassignLoading.value = true
  reassignError.value = ''
  try {
    const newStart = new Date(`${reassignDate.value}T${reassignTime.value}:00`)
    await reassignBooking(
      reassignTarget.value.id,
      selectedCleaner.value.user_id,
      undefined,
      newStart.toISOString(),
    )
    closeReassignModal()
    await loadBooking(reassignTarget.value.id)
  } catch (e) {
    reassignError.value = toUserMessage(e, 'Reassignment failed. Please try again.')
    reassignStep.value = 3
  } finally {
    reassignLoading.value = false
  }
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

.admin-booking-detail {
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  color: var(--secondary, #5e5e5e);
  font-size: 14px;
  font-weight: 600;
}

.detail-card {
  padding: 1.5rem;
  background: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.detail-kicker {
  margin: 0 0 0.5rem;
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  padding: 1.5rem 0;
}

.detail-block,
.detail-notes {
  min-width: 0;
}

.detail-notes {
  padding-top: 1.5rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
}

.detail-label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.detail-value {
  margin: 0;
  color: var(--on-surface, #1a1c1c);
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.detail-sub {
  margin: 0.25rem 0 0;
  color: var(--secondary, #5e5e5e);
  font-size: 14px;
}

@media (min-width: 768px) {
  .detail-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* ── Detail header actions ──────────────────────────────────── */
.detail-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

@media (min-width: 768px) {
  .detail-header-actions {
    align-items: flex-end;
  }
}

.btn-reassign-detail {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 13px;
  font-weight: 500;
  background: var(--primary, #000000);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.btn-reassign-detail:hover {
  opacity: 0.85;
}

.btn-reassign-detail .material-symbols-outlined {
  font-size: 1rem;
}

/* ── Reassignment history ────────────────────────────────────── */
.reassignment-history {
  padding-top: 1.5rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  margin-top: 1.5rem;
}

.reassignment-history__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 1rem;
}

.reassignment-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .reassignment-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.reassignment-block {
  min-width: 0;
}

/* ── Reassign modal (shared elements) ─────────────────────── */
.reassign-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: #fff3e0;
  border: 1px solid #ffcc02;
  padding: 0.875rem 1rem;
  margin-bottom: 1rem;
}

.reassign-warning__icon {
  color: #e65100;
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.reassign-warning__title {
  font-size: 13px;
  font-weight: 600;
  color: #bf360c;
  margin: 0 0 0.2rem;
}

.reassign-warning__body {
  font-size: 12px;
  color: #e65100;
  margin: 0;
}

.reassign-booking-info {
  background: var(--surface-container, #eeeeee);
  padding: 1rem;
}

.reassign-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--secondary, #5e5e5e);
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.25rem;
}

.reassign-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0;
}

.reassign-sub {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0.125rem 0 0;
}

.reassign-error {
  font-size: 13px;
  color: #ba1a1a;
  margin: 0;
}

/* ── Reassign modal shell ──────────────────────────────────── */
.ra-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.ra-box {
  background: #ffffff;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 56rem;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.ra-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
  flex-shrink: 0;
}

.ra-step-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.25rem;
}

.ra-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0;
}

.ra-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
  padding: 0;
  margin-top: 2px;
}

.ra-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.ra-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* ── Step 1: Date inputs ─────────────────────────────────── */
.ra-date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.ra-field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.4rem;
}

.ra-input {
  width: 100%;
  height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  font-size: 14px;
  color: var(--primary, #000000);
  outline: none;
  box-sizing: border-box;
}

.ra-input:focus {
  border-color: var(--primary, #000000);
}

/* ── Step 2: Cleaner loading/empty ────────────────────────── */
.ra-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  padding: 2rem 0;
}

.ra-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: ra-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes ra-spin {
  to { transform: rotate(360deg); }
}

.ra-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 0;
  text-align: center;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
}

/* ── Step 2: Cleaner cards ──────────────────────────────── */
.ra-cleaner-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 600px) {
  .ra-cleaner-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 900px) {
  .ra-cleaner-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.ra-cleaner-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  overflow: hidden;
  transition: border-color 0.15s;
}

.ra-cleaner-card:hover {
  border-color: var(--primary, #000000);
}

.ra-card-img-wrap {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--surface-variant, #e2e2e2);
}

.ra-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  transition: filter 0.4s;
}

.ra-cleaner-card:hover .ra-card-img {
  filter: grayscale(0);
}

.ra-card-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-container, #eeeeee);
}

.ra-top-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
}

.ra-card-body {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ra-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.ra-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0;
}

.ra-card-rating {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.2rem;
  font-size: 13px;
  color: var(--primary, #000000);
}

.ra-star {
  font-size: 14px !important;
  color: #f59e0b;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.ra-review-count {
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
}

.ra-card-price {
  text-align: right;
  flex-shrink: 0;
}

.ra-card-price > span:first-child {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary, #000000);
}

.ra-price-sub {
  display: block;
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
}

.ra-card-bio {
  font-size: 12px;
  color: var(--on-surface-variant, #5e5e5e);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ra-card-footer {
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  padding-top: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ra-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ra-card-service,
.ra-card-avail {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
}

.ra-card-avail {
  color: #2e7d32;
  font-weight: 600;
}

.ra-select-btn {
  width: 100%;
  padding: 0.5rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ra-select-btn:hover {
  opacity: 0.85;
}

/* ── Footer buttons ─────────────────────────────────────── */
.btn-modal-cancel {
  padding: 0.5rem 1rem;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
}

.btn-modal-cancel:hover:not(:disabled) {
  background: var(--surface-variant, #e2e2e2);
}

.btn-modal-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-modal-confirm {
  padding: 0.5rem 1.25rem;
  font-size: 14px;
  font-weight: 500;
  background: var(--primary, #000000);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-modal-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-modal-confirm:hover:not(:disabled) {
  opacity: 0.85;
}
</style>
