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
          <p class="detail-value">{{ booking.payment_status ?? 'Unknown' }}</p>
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

    <!-- Reassign Modal -->
    <AppModal v-model="showReassignModal" title="Reassign Cleaner" size="lg">
      <div class="reassign-modal-body">
        <!-- Active booking warning -->
        <div v-if="reassignTarget?.status === 'in_progress'" class="reassign-warning">
          <span class="material-symbols-outlined reassign-warning__icon">warning</span>
          <div>
            <p class="reassign-warning__title">This booking is currently active</p>
            <p class="reassign-warning__body">Reassigning may disrupt an in-progress service. Confirm only if necessary.</p>
          </div>
        </div>

        <div v-if="reassignTarget" class="reassign-booking-info">
          <p class="reassign-label">Booking</p>
          <p class="reassign-value">
            #{{ reassignTarget.id.slice(0, 8).toUpperCase() }} —
            {{ reassignTarget.service_title_snapshot ?? 'Cleaning Booking' }}
          </p>
          <p class="reassign-sub">
            {{ formatDateTime(reassignTarget.scheduled_start) }} ·
            {{ formatTimeRange(reassignTarget.scheduled_start, reassignTarget.scheduled_end) }}
          </p>
          <p v-if="reassignTarget.current_cleaner_name" class="reassign-sub">
            Current cleaner: {{ reassignTarget.current_cleaner_name }}
          </p>
        </div>

        <div class="reassign-available-section">
          <div class="reassign-available-header">
            <span class="reassign-label">Available Cleaners</span>
            <button
              class="btn-find-cleaners"
              type="button"
              :disabled="cleanerSearchLoading"
              @click="findAvailableCleaners"
            >
              {{ cleanerSearchLoading ? 'Searching…' : 'Refresh' }}
            </button>
          </div>
          <div v-if="cleanerSearchLoading" class="cleaner-search-loading">
            Searching available cleaners…
          </div>
          <div v-else-if="cleanerResults.length > 0" class="cleaner-cards">
            <button
              v-for="c in cleanerResults"
              :key="c.user_id"
              :class="['cleaner-card', selectedCleaner?.user_id === c.user_id && 'cleaner-card--selected']"
              type="button"
              @click="selectedCleaner = c"
            >
              <span class="cleaner-card__name">{{ c.profiles?.full_name ?? c.business_name ?? '—' }}</span>
              <span class="cleaner-card__city">{{ c.profiles?.city ?? '—' }}</span>
              <span class="cleaner-card__rating">
                ★ {{ c.average_rating > 0 ? c.average_rating.toFixed(1) : '—' }}
                · {{ c.review_count }} completed jobs
              </span>
              <span class="cleaner-card__available">✓ Available</span>
            </button>
          </div>
          <div v-else-if="cleanerSearched && !cleanerSearchLoading" class="cleaner-empty">
            <p class="cleaner-empty__msg">No available replacement cleaners found.</p>
          </div>
        </div>

        <p v-if="reassignError" class="reassign-error">{{ reassignError }}</p>
      </div>
      <template #footer>
        <button class="btn-modal-cancel" type="button" @click="closeReassignModal">Cancel</button>
        <button
          class="btn-modal-confirm"
          type="button"
          :disabled="!selectedCleaner || reassignLoading"
          @click="submitReassign"
        >
          {{ reassignLoading ? 'Reassigning…' : 'Confirm Reassignment' }}
        </button>
      </template>
    </AppModal>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getBookingById, reassignBooking, type BookingDetailRow } from '@/services/bookingService'
import { searchCleaners, type CleanerSearchResult } from '@/services/cleanerService'
import { formatDateTime, formatPence } from '@/utils/format'
import { getBookingStatusLabel, getStatusPillClass } from '@/utils/bookingStatusLabel'
import AppModal from '@/components/ui/AppModal.vue'

const REASSIGNABLE_STATUSES = new Set([
  'cleaner_no_show', 'accepted', 'in_progress', 'paid',
  'cleaner_cancelled', 'reassign_requested', 'pending_request',
])

const route = useRoute()
const booking = ref<BookingDetailRow | null>(null)
const loading = ref(false)
const errorMessage = ref('')

// Reassign modal state
const showReassignModal = ref(false)
const reassignTarget = ref<BookingDetailRow | null>(null)
const cleanerResults = ref<CleanerSearchResult[]>([])
const cleanerSearchLoading = ref(false)
const cleanerSearched = ref(false)
const selectedCleaner = ref<CleanerSearchResult | null>(null)
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
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load booking.'
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

function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return 'Duration TBC'
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.valueOf()) || Number.isNaN(e.valueOf())) return '-'
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${fmt.format(s)} - ${fmt.format(e)}`
}

async function openReassignModal(b: BookingDetailRow) {
  reassignTarget.value = b
  cleanerResults.value = []
  cleanerSearched.value = false
  selectedCleaner.value = null
  reassignError.value = ''
  showReassignModal.value = true
  await findAvailableCleaners()
}

function closeReassignModal() {
  showReassignModal.value = false
  reassignTarget.value = null
  cleanerResults.value = []
  selectedCleaner.value = null
  reassignError.value = ''
}

async function findAvailableCleaners() {
  if (!reassignTarget.value?.scheduled_start) return
  const start = reassignTarget.value.scheduled_start
  const dateStr = start.split('T')[0]
  const timeStr = start.split('T')[1]?.slice(0, 5) ?? '09:00'

  cleanerSearchLoading.value = true
  cleanerSearched.value = false
  cleanerResults.value = []
  try {
    const results = await searchCleaners({
      availabilityDate: dateStr,
      availabilityTime: timeStr,
      serviceCategory: reassignTarget.value.category_snapshot ?? undefined,
    })
    const currentCleanerId = reassignTarget.value.cleaner_id
    cleanerResults.value = currentCleanerId
      ? results.filter((c) => c.user_id !== currentCleanerId)
      : results
    cleanerSearched.value = true
  } catch {
    cleanerResults.value = []
    cleanerSearched.value = true
  } finally {
    cleanerSearchLoading.value = false
  }
}

async function submitReassign() {
  if (!selectedCleaner.value || !reassignTarget.value) return
  reassignLoading.value = true
  reassignError.value = ''
  try {
    await reassignBooking(reassignTarget.value.id, selectedCleaner.value.user_id)
    closeReassignModal()
    await loadBooking(reassignTarget.value.id)
  } catch (e) {
    reassignError.value = e instanceof Error ? e.message : 'Reassignment failed.'
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

/* ── Reassign modal ────────────────────────────────────────── */
.reassign-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.reassign-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: #fff3e0;
  border: 1px solid #ffcc02;
  padding: 0.875rem 1rem;
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
  font-size: 12px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.reassign-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0.25rem 0 0;
}

.reassign-sub {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0.125rem 0 0;
}

.reassign-available-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reassign-available-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-find-cleaners {
  padding: 0.375rem 0.75rem;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-find-cleaners:hover:not(:disabled) {
  background-color: var(--surface-variant, #e2e2e2);
}

.btn-find-cleaners:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cleaner-search-loading {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  padding: 0.5rem 0;
}

.cleaner-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;
  max-height: 18rem;
  overflow-y: auto;
}

@media (min-width: 480px) {
  .cleaner-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

.cleaner-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background-color 0.15s;
}

.cleaner-card:hover {
  border-color: var(--primary, #000000);
}

.cleaner-card--selected {
  border-color: var(--primary, #000000);
  background: var(--surface-container, #eeeeee);
}

.cleaner-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary, #000000);
}

.cleaner-card__city {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.cleaner-card__rating {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin-top: 0.25rem;
}

.cleaner-card__available {
  font-size: 11px;
  color: #2e7d32;
  font-weight: 600;
  margin-top: 0.125rem;
}

.cleaner-empty {
  padding: 1rem;
  background: var(--surface-container, #eeeeee);
}

.cleaner-empty__msg {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.reassign-error {
  font-size: 13px;
  color: #ba1a1a;
  margin: 0;
}

.btn-modal-cancel {
  padding: 0.5rem 1rem;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
}

.btn-modal-cancel:hover {
  background: var(--surface-variant, #e2e2e2);
}

.btn-modal-confirm {
  padding: 0.5rem 1rem;
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
