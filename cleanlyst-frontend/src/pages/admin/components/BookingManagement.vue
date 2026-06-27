<template>
  <main class="page-main">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="header-title">Booking Management</h1>
        <p class="header-copy">Monitor and manage service transactions across the platform.</p>
      </div>
    </div>

    <p v-if="errorMessage" class="mb-4 text-caption text-red-600">{{ errorMessage }}</p>

    <!-- Reassign Modal -->
    <AppModal v-model="showReassignModal" title="Reassign Cleaner" size="lg">
      <div class="reassign-modal-body">
        <!-- Active booking warning -->
        <div v-if="reassignBookingInfo?.status === 'in_progress'" class="reassign-warning">
          <span class="material-symbols-outlined reassign-warning__icon">warning</span>
          <div>
            <p class="reassign-warning__title">This booking is currently active</p>
            <p class="reassign-warning__body">Reassigning may disrupt an in-progress service. Confirm only if necessary.</p>
          </div>
        </div>

        <div v-if="reassignBookingInfo" class="reassign-booking-info">
          <p class="reassign-label">Booking</p>
          <p class="reassign-value">#{{ reassignBookingInfo.id.slice(0, 8).toUpperCase() }} — {{ reassignBookingInfo.service_title_snapshot ?? 'Cleaning Booking' }}</p>
          <p class="reassign-sub">{{ formatDate(reassignBookingInfo.scheduled_start ?? '') }} · {{ formatTimeRange(reassignBookingInfo.scheduled_start, reassignBookingInfo.scheduled_end) }}</p>
          <p v-if="reassignBookingInfo.cleaner_name" class="reassign-sub">
            Current cleaner: {{ reassignBookingInfo.cleaner_name }}
          </p>
        </div>
        <div v-if="!reassignBookingInfo" class="reassign-field">
          <label class="reassign-label" for="reassign-booking-id">Booking ID</label>
          <input
            id="reassign-booking-id"
            v-model="reassignBookingIdInput"
            class="reassign-input"
            placeholder="Enter booking ID…"
            type="text"
          />
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
              @click="selectCleaner(c)"
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

    <!-- Filter Bar -->
    <div class="clnst-filter-bar">
      <div class="clnst-tab-group">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          :class="['clnst-tab-btn', activeTab === tab.value && 'clnst-tab-btn--active']"
          @click="setTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="clnst-filter-divider"></div>
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="Search by service or status…"
          type="text"
          @input="onSearchInput"
        />
      </div>
    </div>

    <!-- Bookings List -->
    <div class="bookings-list">
      <div v-if="loading" class="booking-empty">Loading bookings…</div>
      <div v-else-if="bookings.length === 0" class="booking-empty">No bookings found.</div>

      <div
        v-for="booking in bookings"
        :key="booking.id"
        :class="['booking-row', booking.status === 'cancelled' && 'booking-row--cancelled']"
      >
        <div class="flex-shrink-0">
          <div class="booking-icon-box">
            <span class="material-symbols-outlined">{{ statusIcon(booking.status) }}</span>
          </div>
        </div>
        <div class="booking-grid">
          <div>
            <span class="col-label">BOOKING ID</span>
            <span class="col-value font-mono text-sm"
              >#{{ booking.id.slice(0, 8).toUpperCase() }}</span
            >
          </div>
          <div>
            <span class="col-label">CLIENT / CLEANER</span>
            <div class="col-value">{{ booking.customer_name ?? '—' }}</div>
            <div class="col-sub">{{ cleanerLabel(booking) }}</div>
          </div>
          <div>
            <span class="col-label">SCHEDULE</span>
            <div class="col-value">{{ formatDate(booking.scheduled_start) }}</div>
            <div class="col-sub">
              {{ formatTimeRange(booking.scheduled_start, booking.scheduled_end) }}
            </div>
          </div>
          <div>
            <span class="col-label">STATUS</span>
            <span :class="['status-badge', statusBadgeClass(booking.status)]">
              {{ formatStatus(booking.status) }}
            </span>
            <div v-if="booking.no_show_action" class="col-sub">
              {{ formatNoShowAction(booking.no_show_action) }}
            </div>
          </div>
        </div>
        <div class="row-actions">
          <span class="col-value">{{ formatPence(booking.quote_cents) }}</span>
          <span
            v-if="booking.original_cleaner_id && !REASSIGNABLE_STATUSES.has(booking.status)"
            class="badge-reassigned"
          >
            Reassigned
          </span>
          <button
            v-else-if="REASSIGNABLE_STATUSES.has(booking.status)"
            class="btn-reassign"
            type="button"
            @click="openReassignForBooking(booking)"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="!loading && totalCount > 0"
      class="flex items-center justify-between mt-6 pt-4 border-t border-outline-variant"
    >
      <span class="font-caption text-caption text-secondary">
        Page {{ page }} of {{ totalPages }}
        <span class="ml-2 opacity-60">({{ totalCount }} total)</span>
      </span>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 border border-outline-variant text-label-md disabled:opacity-40"
          :disabled="page === 1 || loading"
          @click="goToPage(page - 1)"
        >
          Previous
        </button>
        <button
          class="px-3 py-1.5 border border-outline-variant text-label-md disabled:opacity-40"
          :disabled="page >= totalPages || loading"
          @click="goToPage(page + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Activity Monitor -->
    <div class="overrides-section">
      <div class="overrides-main">
        <h2 class="overrides-heading">System Overrides</h2>
        <div class="info-banner">
          <span class="material-symbols-outlined info-banner__icon">info</span>
          <div>
            <p class="info-banner__title">Global Dispute Protocol</p>
            <p class="info-banner__body">
              Administrative overrides will log the action, timestamp, and operator ID. All manual
              modifications are subject to audit logs.
            </p>
          </div>
        </div>
        <div class="override-grid">
          <button class="override-card" data-testid="open-refund-modal" @click="openRefundModal(null)">
            <span class="material-symbols-outlined override-card__icon">payments</span>
            <span class="override-card__title">Process Refund</span>
            <span class="override-card__desc"
              >Issue full or partial refunds with reason tracking.</span
            >
          </button>
          <button class="override-card" @click="openReassignModal">
            <span class="material-symbols-outlined override-card__icon">person_search</span>
            <span class="override-card__title">Reassign Cleaner</span>
            <span class="override-card__desc"
              >Manually switch service providers for active bookings.</span
            >
          </button>
        </div>
      </div>

      <div class="activity-sidebar">
        <h3 class="activity-sidebar__heading">Activity Monitor</h3>
        <div v-if="activityLoading" class="text-caption text-secondary">Loading…</div>
        <div v-else-if="activityEvents.length === 0" class="text-caption text-secondary">
          No recent activity.
        </div>
        <div v-else class="activity-list">
          <div v-for="event in activityEvents.slice(0,4)" :key="event.id" class="activity-item">
            <div :class="['activity-dot', event.isFirst ? '' : 'activity-dot--inactive']"></div>
            <div>
              <p class="activity-item__title">
                #{{ event.booking_id.slice(0, 8).toUpperCase() }}:
                {{ formatStatus(event.from_status ?? '') }} →
                {{ formatStatus(event.to_status ?? '') }}
              </p>
              <p class="activity-item__meta">{{ formatRelativeTime(event.created_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- ── Refund Modal ──────────────────────────────────────── -->
  <div v-if="refundModal.open" class="modal-backdrop" @click.self="closeRefundModal">
    <div class="modal-box refund-modal-box">
      <div class="modal-header">
        <h2 class="modal-title">Process Refund</h2>
        <button class="modal-close" type="button" :disabled="refundModal.loading" @click="closeRefundModal">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="refund-modal-body">
        <!-- Booking ID input (when not opened from a specific booking) -->
        <div v-if="!refundModal.bookingId" class="reassign-field">
          <label class="reassign-label" for="refund-booking-id">Booking ID</label>
          <div class="refund-id-row">
            <input
              id="refund-booking-id"
              v-model="refundModal.bookingIdInput"
              class="reassign-input refund-id-input"
              placeholder="Paste booking ID…"
              type="text"
            />
            <button class="btn-find-cleaners" type="button" :disabled="refundModal.lookupLoading" @click="lookupRefundBooking">
              {{ refundModal.lookupLoading ? 'Loading…' : 'Look up' }}
            </button>
          </div>
          <p v-if="refundModal.lookupError" class="reassign-error">{{ refundModal.lookupError }}</p>
        </div>

        <!-- Booking details -->
        <div v-if="refundModal.booking" class="reassign-booking-info">
          <p class="reassign-label">Booking</p>
          <p class="reassign-value">#{{ refundModal.booking.id.slice(0, 8).toUpperCase() }} — {{ refundModal.booking.service_title_snapshot ?? 'Booking' }}</p>
          <p class="reassign-sub">{{ formatDate(refundModal.booking.scheduled_start ?? '') }}</p>
          <p v-if="refundModal.booking.customer_name" class="reassign-sub">Customer: {{ refundModal.booking.customer_name }}</p>
          <p v-if="refundModal.booking.cleaner_name" class="reassign-sub">Cleaner: {{ refundModal.booking.cleaner_name }}</p>

          <!-- Payment summary -->
          <div v-if="refundModal.payment" class="refund-payment-summary">
            <div class="refund-summary-row">
              <span>Booking total</span>
              <strong>{{ formatPence(refundModal.payment.amount_cents) }}</strong>
            </div>
            <div class="refund-summary-row">
              <span>Platform fee</span>
              <span>{{ formatPence(refundModal.payment.platform_fee_cents ?? 0) }}</span>
            </div>
            <div class="refund-summary-row">
              <span>Cleaner payout</span>
              <span>{{ formatPence(refundModal.payment.cleaner_payout_cents ?? 0) }}</span>
            </div>
            <div v-if="refundModal.payment.refund_cents" class="refund-summary-row refund-summary-row--refunded">
              <span>Previously refunded</span>
              <span>{{ formatPence(refundModal.payment.refund_cents) }}</span>
            </div>
            <div class="refund-summary-row">
              <span>Payment status</span>
              <span class="refund-status-badge">{{ refundModal.payment.status }}</span>
            </div>
          </div>

          <!-- Refund type -->
          <div class="refund-type-row">
            <label class="reassign-label">Refund Type</label>
            <div class="refund-type-options">
              <label class="refund-type-option">
                <input v-model="refundModal.refundType" type="radio" value="full" class="mr-2" />
                Full refund ({{ refundModal.payment ? formatPence(refundModal.payment.amount_cents) : '—' }})
              </label>
              <label class="refund-type-option">
                <input v-model="refundModal.refundType" type="radio" value="partial" class="mr-2" />
                Custom amount
              </label>
            </div>
          </div>

          <!-- Custom amount -->
          <div v-if="refundModal.refundType === 'partial'" class="reassign-field">
            <label class="reassign-label" for="refund-amount">Refund Amount (£)</label>
            <input
              id="refund-amount"
              v-model="refundModal.customAmountStr"
              class="reassign-input"
              placeholder="e.g. 25.00"
              type="number"
              min="0.01"
              :max="refundModal.payment ? refundModal.payment.amount_cents / 100 : undefined"
              step="0.01"
            />
            <p v-if="refundModal.customAmountStr" class="reassign-sub mt-1">
              Customer refund: {{ formatPence(Math.round(parseFloat(refundModal.customAmountStr) * 100)) }}
            </p>
          </div>

          <!-- Reason -->
          <div class="reassign-field">
            <label class="reassign-label" for="refund-reason">Reason <span class="text-red-500">*</span></label>
            <select id="refund-reason" v-model="refundModal.reason" class="reassign-input">
              <option value="">Select reason…</option>
              <option value="cleaner_no_show">Cleaner no-show</option>
              <option value="customer_cancellation">Customer cancellation</option>
              <option value="service_issue">Service issue</option>
              <option value="duplicate_payment">Duplicate payment</option>
              <option value="manual_adjustment">Manual adjustment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <!-- Notes -->
          <div class="reassign-field">
            <label class="reassign-label" for="refund-notes">Notes (optional)</label>
            <textarea
              id="refund-notes"
              v-model="refundModal.notes"
              class="reassign-input"
              rows="2"
              placeholder="Additional context for the audit log…"
              style="resize:vertical;height:64px"
            />
          </div>

          <!-- Result preview -->
          <div v-if="refundModal.result" class="refund-result">
            <span class="material-symbols-outlined refund-result__icon">check_circle</span>
            <p class="refund-result__title">Refund processed</p>
            <p class="refund-result__body">
              {{ formatPence(refundModal.result.refund_cents) }} refunded to customer.
            </p>
          </div>

          <p v-if="refundModal.error" class="reassign-error">{{ refundModal.error }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="refund-modal-footer">
        <button class="btn-modal-cancel" type="button" :disabled="refundModal.loading" @click="closeRefundModal">
          {{ refundModal.result ? 'Close' : 'Cancel' }}
        </button>
        <button
          v-if="!refundModal.result && refundModal.booking"
          class="btn-modal-confirm"
          data-testid="confirm-refund-btn"
          type="button"
          :disabled="refundModal.loading || !refundModal.reason"
          @click="submitRefund"
        >
          {{ refundModal.loading ? 'Processing…' : 'Process Refund' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { formatDate, formatStatus, formatPence, formatRelativeTime, toUserMessage } from '@/utils/format'
import AppModal from '@/components/ui/AppModal.vue'
import { reassignBooking } from '@/services/bookingService'
import { searchCleaners, type CleanerSearchResult } from '@/services/cleanerService'
import { processRefund, type AdminRefundResult } from '@/services/adminService'

const PAGE_SIZE = 10

const TABS = [
  { label: 'All Bookings', value: '' },
  { label: 'Pending', value: 'pending_request' },
  { label: 'Active', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'No-shows', value: 'cleaner_no_show' },
  { label: 'Reassign', value: 'reassign_requested' },
]

const REASSIGNABLE_STATUSES = new Set([
  'cleaner_no_show',
  'accepted',
  'in_progress',
  'paid',
  'cleaner_cancelled',
  'reassign_requested',
  'pending_request',
])

interface BookingRow {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  service_title_snapshot: string | null
  category_snapshot: string | null
  quote_cents: number
  customer_name: string | null
  cleaner_name: string | null
  cleaner_id: string | null
  no_show_action: string | null
  original_cleaner_id: string | null
  reassigned_at: string | null
}

interface BookingQueryRow {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  service_title_snapshot: string | null
  category_snapshot: string | null
  quote_cents: number | null
  no_show_action: string | null
  cleaner_id: string | null
  original_cleaner_id: string | null
  reassigned_at: string | null
  customer?: {
    full_name?: string | null
  } | null
  cleaner?: {
    full_name?: string | null
  } | null
}

interface ActivityQueryRow {
  id: string
  booking_id: string
  from_status: string | null
  to_status: string | null
  created_at: string
}

interface ActivityEvent {
  id: string
  booking_id: string
  from_status: string | null
  to_status: string | null
  created_at: string
  isFirst: boolean
}

const loading = ref(false)
const activityLoading = ref(false)
const errorMessage = ref('')
const activeTab = ref('')
const searchQuery = ref('')
const page = ref(1)
const totalCount = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

const bookings = ref<BookingRow[]>([])
const activityEvents = ref<ActivityEvent[]>([])

let searchTimeout: ReturnType<typeof setTimeout>

onMounted(async () => {
  await Promise.all([loadBookings(), loadActivity()])
})

function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    loadBookings()
  }, 350)
}

function setTab(value: string) {
  activeTab.value = value
  page.value = 1
  loadBookings()
}

function goToPage(n: number) {
  page.value = n
  loadBookings()
}

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const supabase = requireSupabase()
    const term = searchQuery.value.trim()
    const start = (page.value - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE - 1

    // Pre-query: find profile IDs whose full_name matches the search term
    let matchingProfileIds: string[] | null = null
    if (term) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${term}%`)
      if (profiles && profiles.length > 0) {
        matchingProfileIds = (profiles as { id: string }[]).map((p) => p.id)
      }
    }

    let q = supabase
      .from('bookings')
      .select(
        `id, status, scheduled_start, scheduled_end,
         service_title_snapshot, category_snapshot, quote_cents,
         no_show_action, cleaner_id, original_cleaner_id, reassigned_at,
         customer:customer_id(full_name),
         cleaner:cleaner_id(full_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(start, end)

    if (activeTab.value) {
      if (activeTab.value === 'pending_request') {
        q = q.in('status', ['pending_request', 'awaiting_customer_payment', 'payment_authorized'])
      } else if (activeTab.value === 'cleaner_no_show') {
        q = q.not('no_show_action', 'is', null)
      } else {
        q = q.eq('status', activeTab.value)
      }
    }

    if (term) {
      const parts: string[] = [
        `service_title_snapshot.ilike.%${term}%`,
        `id.ilike.%${term}%`,
        `status.ilike.%${term}%`,
      ]
      if (matchingProfileIds && matchingProfileIds.length > 0) {
        parts.push(`customer_id.in.(${matchingProfileIds.join(',')})`)
        parts.push(`cleaner_id.in.(${matchingProfileIds.join(',')})`)
      }
      q = q.or(parts.join(','))
    }

    const { data, error, count } = await q
    if (error) throw error

    totalCount.value = count ?? 0
    const rows = (data ?? []) as BookingQueryRow[]
    bookings.value = rows.map((row) => ({
      id: row.id,
      status: row.status,
      scheduled_start: row.scheduled_start ?? null,
      scheduled_end: row.scheduled_end ?? null,
      service_title_snapshot: row.service_title_snapshot ?? null,
      category_snapshot: row.category_snapshot ?? null,
      quote_cents: row.quote_cents ?? 0,
      customer_name: row.customer?.full_name ?? null,
      cleaner_name: row.cleaner?.full_name ?? null,
      cleaner_id: row.cleaner_id ?? null,
      no_show_action: row.no_show_action ?? null,
      original_cleaner_id: row.original_cleaner_id ?? null,
      reassigned_at: row.reassigned_at ?? null,
    }))
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to load bookings. Please refresh.')
  } finally {
    loading.value = false
  }
}

async function loadActivity() {
  activityLoading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('booking_status_events')
      .select('id, booking_id, from_status, to_status, created_at')
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) throw error

    const activityRows = (data ?? []) as ActivityQueryRow[]
    activityEvents.value = activityRows.map((row, i) => ({
      id: row.id,
      booking_id: row.booking_id,
      from_status: row.from_status ?? null,
      to_status: row.to_status ?? null,
      created_at: row.created_at,
      isFirst: i === 0,
    }))
  } catch {
    // Activity feed is non-critical; silently ignore
  } finally {
    activityLoading.value = false
  }
}

// ── Reassignment modal ─────────────────────────────────────────────────
const showReassignModal = ref(false)
const reassignBookingInfo = ref<BookingRow | null>(null)
const reassignBookingIdInput = ref('')
const cleanerResults = ref<CleanerSearchResult[]>([])
const cleanerSearchLoading = ref(false)
const cleanerSearched = ref(false)
const selectedCleaner = ref<CleanerSearchResult | null>(null)
const reassignLoading = ref(false)
const reassignError = ref('')

function openReassignModal() {
  reassignBookingInfo.value = null
  reassignBookingIdInput.value = ''
  cleanerResults.value = []
  cleanerSearched.value = false
  selectedCleaner.value = null
  reassignError.value = ''
  showReassignModal.value = true
}

async function openReassignForBooking(booking: BookingRow) {
  reassignBookingInfo.value = booking
  reassignBookingIdInput.value = booking.id
  cleanerResults.value = []
  cleanerSearched.value = false
  selectedCleaner.value = null
  reassignError.value = ''
  showReassignModal.value = true
  await findAvailableCleaners()
}

function closeReassignModal() {
  showReassignModal.value = false
  reassignBookingInfo.value = null
  reassignBookingIdInput.value = ''
  cleanerResults.value = []
  cleanerSearchLoading.value = false
  cleanerSearched.value = false
  selectedCleaner.value = null
  reassignError.value = ''
}

async function findAvailableCleaners() {
  if (!reassignBookingInfo.value?.scheduled_start) return
  const start = reassignBookingInfo.value.scheduled_start
  const dateStr = start.split('T')[0]
  const timeStr = start.split('T')[1]?.slice(0, 5) ?? '09:00'

  cleanerSearchLoading.value = true
  cleanerSearched.value = false
  cleanerResults.value = []
  try {
    const results = await searchCleaners({
      availabilityDate: dateStr,
      availabilityTime: timeStr,
      serviceCategory: reassignBookingInfo.value.category_snapshot ?? undefined,
    })
    // Exclude the current cleaner from replacement candidates
    const currentCleanerId = reassignBookingInfo.value.cleaner_id
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

function selectCleaner(c: CleanerSearchResult) {
  selectedCleaner.value = c
}

async function submitReassign() {
  if (!selectedCleaner.value) return
  const bookingId = reassignBookingInfo.value?.id ?? reassignBookingIdInput.value.trim()
  if (!bookingId) {
    reassignError.value = 'Please enter a booking ID.'
    return
  }
  reassignLoading.value = true
  reassignError.value = ''
  try {
    await reassignBooking(bookingId, selectedCleaner.value.user_id)
    closeReassignModal()
    await loadBookings()
  } catch (e) {
    reassignError.value = toUserMessage(e, 'Reassignment failed. Please try again.')
  } finally {
    reassignLoading.value = false
  }
}

function cleanerLabel(booking: BookingRow): string {
  if (booking.cleaner_name) return `assigned to ${booking.cleaner_name}`
  if (['pending_request', 'awaiting_customer_payment'].includes(booking.status))
    return 'Awaiting assignment'
  return '—'
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const fmt = (v: string) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).format(
      new Date(v),
    )
  return `${fmt(start)} – ${fmt(end)}`
}

function statusIcon(status: string): string {
  const map: Record<string, string> = {
    pending_request: 'schedule',
    awaiting_customer_payment: 'payment',
    payment_authorized: 'verified',
    in_progress: 'cleaning_services',
    completed: 'task_alt',
    cancelled: 'cancel',
    refunded: 'undo',
    cleaner_no_show: 'event_busy',
  }
  return map[status] ?? 'calendar_today'
}

function statusBadgeClass(status: string): string {
  if (status === 'in_progress' || status === 'payment_authorized') return 'status-badge--active'
  if (status === 'completed') return 'status-badge--completed'
  if (status === 'cancelled' || status === 'refunded' || status === 'cleaner_no_show')
    return 'status-badge--cancelled'
  return 'status-badge--pending'
}

function formatNoShowAction(action: string): string {
  if (action === 'replacement_requested') return 'Replacement cleaner requested'
  if (action === 'refund_requested') return 'Refund requested'
  return formatStatus(action)
}

// ── Refund modal ───────────────────────────────────────────────────────

interface PaymentInfo {
  id: string
  amount_cents: number
  platform_fee_cents: number | null
  cleaner_payout_cents: number | null
  status: string
  refund_cents: number | null
}

interface RefundModal {
  open: boolean
  bookingId: string | null
  bookingIdInput: string
  lookupLoading: boolean
  lookupError: string
  booking: BookingRow | null
  payment: PaymentInfo | null
  refundType: 'full' | 'partial'
  customAmountStr: string
  reason: string
  notes: string
  loading: boolean
  error: string
  result: AdminRefundResult | null
}

const refundModal = reactive<RefundModal>({
  open: false,
  bookingId: null,
  bookingIdInput: '',
  lookupLoading: false,
  lookupError: '',
  booking: null,
  payment: null,
  refundType: 'full',
  customAmountStr: '',
  reason: '',
  notes: '',
  loading: false,
  error: '',
  result: null,
})

function openRefundModal(booking: BookingRow | null) {
  refundModal.open = true
  refundModal.booking = booking
  refundModal.bookingId = booking?.id ?? null
  refundModal.bookingIdInput = ''
  refundModal.lookupLoading = false
  refundModal.lookupError = ''
  refundModal.payment = null
  refundModal.refundType = 'full'
  refundModal.customAmountStr = ''
  refundModal.reason = ''
  refundModal.notes = ''
  refundModal.loading = false
  refundModal.error = ''
  refundModal.result = null

  if (booking) {
    loadRefundPayment(booking.id)
  }
}

function closeRefundModal() {
  refundModal.open = false
}

async function loadRefundPayment(bookingId: string) {
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount_cents, platform_fee_cents, cleaner_payout_cents, status, refund_cents')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (error) throw error
    refundModal.payment = data as PaymentInfo | null
  } catch {
    // Non-critical; payment summary just won't show
  }
}

async function lookupRefundBooking() {
  const id = refundModal.bookingIdInput.trim()
  if (!id) return
  refundModal.lookupLoading = true
  refundModal.lookupError = ''
  refundModal.booking = null
  refundModal.payment = null
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .select(
        `id, status, scheduled_start, scheduled_end,
         service_title_snapshot, category_snapshot, quote_cents,
         no_show_action, cleaner_id, original_cleaner_id, reassigned_at,
         customer:customer_id(full_name),
         cleaner:cleaner_id(full_name)`,
      )
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      refundModal.lookupError = 'Booking not found.'
      return
    }
    const row = data as BookingQueryRow
    refundModal.booking = {
      id: row.id,
      status: row.status,
      scheduled_start: row.scheduled_start ?? null,
      scheduled_end: row.scheduled_end ?? null,
      service_title_snapshot: row.service_title_snapshot ?? null,
      category_snapshot: row.category_snapshot ?? null,
      quote_cents: row.quote_cents ?? 0,
      customer_name: row.customer?.full_name ?? null,
      cleaner_name: row.cleaner?.full_name ?? null,
      cleaner_id: row.cleaner_id ?? null,
      no_show_action: row.no_show_action ?? null,
      original_cleaner_id: row.original_cleaner_id ?? null,
      reassigned_at: row.reassigned_at ?? null,
    }
    await loadRefundPayment(id)
  } catch (e) {
    refundModal.lookupError = toUserMessage(e, 'Failed to find that booking. Please try again.')
  } finally {
    refundModal.lookupLoading = false
  }
}

async function submitRefund() {
  const bookingId = refundModal.booking?.id
  if (!bookingId || !refundModal.reason) return

  let refundCents: number
  if (refundModal.refundType === 'full') {
    refundCents = refundModal.payment?.amount_cents ?? 0
  } else {
    refundCents = Math.round(parseFloat(refundModal.customAmountStr) * 100)
    if (!refundCents || refundCents <= 0) {
      refundModal.error = 'Please enter a valid refund amount.'
      return
    }
    if (refundModal.payment && refundCents > refundModal.payment.amount_cents) {
      refundModal.error = 'Refund amount exceeds the payment total.'
      return
    }
  }

  refundModal.loading = true
  refundModal.error = ''
  try {
    const result = await processRefund(
      bookingId,
      refundCents,
      refundModal.reason,
      refundModal.notes || undefined,
    )
    refundModal.result = result
    await loadBookings()
  } catch (e) {
    refundModal.error = toUserMessage(e, 'Failed to process refund. Please try again.')
  } finally {
    refundModal.loading = false
  }
}
</script>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────── */
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

/* ── Page layout ──────────────────────────────────────────── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

/* ── Page header ──────────────────────────────────────────── */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 3rem;
}

@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  max-width: 42rem;
  margin: 0;
}

/* ── Search ───────────────────────────────────────────────── */
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
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  background: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--primary, #000000);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--primary, #000000);
}

.search-input::placeholder {
  color: var(--secondary, #5e5e5e);
}

/* ── Bookings list ────────────────────────────────────────── */
.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.booking-empty {
  padding: 3rem;
  text-align: center;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: var(--surface-container-lowest, #ffffff);
}

/* ── Booking row ──────────────────────────────────────────── */
.booking-row {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
  background: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 24px;
  transition: box-shadow 0.15s ease;
}

.booking-row:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

@media (min-width: 1024px) {
  .booking-row {
    flex-direction: row;
    align-items: center;
  }
}

.booking-row--cancelled {
  opacity: 0.7;
}

/* ── Booking icon box ─────────────────────────────────────── */
.booking-icon-box {
  width: 3rem;
  height: 3rem;
  background: var(--surface-variant, #e2e2e2);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: var(--primary, #000000);
  flex-shrink: 0;
}

/* ── Booking grid ─────────────────────────────────────────── */
.booking-grid {
  flex-grow: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  width: 100%;
}

@media (min-width: 768px) {
  .booking-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .booking-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* ── Column typography ────────────────────────────────────── */
.col-label {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
  display: block;
  margin-bottom: 0.25rem;
}

.col-value {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.col-sub {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

/* ── Status badge ─────────────────────────────────────────── */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  background: #f4f4f5;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.status-badge--active {
  color: #27272a;
}
.status-badge--pending {
  color: #71717a;
}
.status-badge--completed {
  color: #27272a;
}
.status-badge--cancelled {
  color: #a1a1aa;
}

/* ── Row actions ──────────────────────────────────────────── */
.row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

/* ── Overrides section ────────────────────────────────────── */
.overrides-section {
  margin-top: 4rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .overrides-section {
    grid-template-columns: repeat(3, 1fr);
  }
}

.overrides-main {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .overrides-main {
    grid-column: span 2;
  }
}

.overrides-heading {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin: 0;
}

/* ── Info banner ──────────────────────────────────────────── */
.info-banner {
  background: var(--surface-container, #eeeeee);
  padding: 24px;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.info-banner__icon {
  color: var(--primary, #000000);
  padding-top: 0.125rem;
  flex-shrink: 0;
}
.info-banner__title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  margin: 0 0 0.25rem;
}
.info-banner__body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Override grid ────────────────────────────────────────── */
.override-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .override-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ── Override card ────────────────────────────────────────── */
.override-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.override-card:hover {
  border-color: var(--primary, #000000);
}
.override-card__icon {
  margin-bottom: 1rem;
  color: var(--primary, #000000);
}
.override-card__title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  margin-bottom: 0.25rem;
}
.override-card__desc {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

/* ── Activity sidebar ─────────────────────────────────────── */
.activity-sidebar {
  background: var(--surface-container-low, #f3f3f3);
  padding: 24px;
  border: 1px solid var(--outline-variant, #c4c7c7);
}

.activity-sidebar__heading {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  margin: 0 0 1.5rem;
}

/* ── Activity list ────────────────────────────────────────── */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.activity-item {
  display: flex;
  gap: 1rem;
}

.activity-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--primary, #000000);
  margin-top: 0.375rem;
  flex-shrink: 0;
}

.activity-dot--inactive {
  background: var(--outline-variant, #c4c7c7);
}

.activity-item__title {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--primary, #000000);
  margin: 0 0 0.125rem;
}
.activity-item__meta {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Reassign button (per row) ──────────────────────────────── */
.btn-reassign {
  padding: 0.375rem 0.75rem;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  transition: background-color 0.15s;
  white-space: nowrap;
}

.btn-reassign:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

/* ── Reassign modal body ────────────────────────────────────── */
.reassign-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.reassign-booking-info {
  background: var(--surface-container, #eeeeee);
  padding: 1rem;
}

.reassign-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  position: relative;
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

.reassign-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  color: var(--primary, #000000);
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
}

.reassign-input:focus {
  border-color: var(--primary, #000000);
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

.reassign-error {
  font-size: 13px;
  color: #ba1a1a;
  margin: 0;
}

/* ── Reassign warning (active booking) ──────────────────────── */
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

/* ── Already-reassigned badge ───────────────────────────────── */
.badge-reassigned {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
  white-space: nowrap;
}

/* ── Cleaner card available indicator ──────────────────────── */
.cleaner-card__available {
  font-size: 11px;
  color: #2e7d32;
  font-weight: 600;
  margin-top: 0.125rem;
}

/* ── No cleaners found ──────────────────────────────────────── */
.cleaner-empty {
  padding: 1rem;
  background: var(--surface-container, #eeeeee);
}

.cleaner-empty__msg {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.5rem;
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

/* ── Refund modal ─────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-box {
  background: #ffffff;
  max-height: 90vh;
  overflow-y: auto;
  width: 100%;
}

.refund-modal-box {
  max-width: 36rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  line-height: 1;
  padding: 0.25rem;
}

.modal-close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.refund-modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.refund-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
}

.refund-id-row {
  display: flex;
  gap: 0.5rem;
}

.refund-id-input {
  flex: 1;
}

.refund-payment-summary {
  margin-top: 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.refund-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
}

.refund-summary-row strong {
  color: var(--primary, #000000);
  font-weight: 600;
}

.refund-summary-row--refunded {
  color: #b91c1c;
}

.refund-status-badge {
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.refund-type-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.refund-type-options {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.refund-type-option {
  display: flex;
  align-items: center;
  font-size: 14px;
  cursor: pointer;
}

.refund-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  text-align: center;
}

.refund-result__icon {
  font-size: 32px;
  color: #16a34a;
}

.refund-result__title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #15803d;
}

.refund-result__body {
  font-size: 14px;
  margin: 0;
  color: #166534;
}
</style>
