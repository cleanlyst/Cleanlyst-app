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
          </div>
        </div>
        <div class="row-actions">
          <span class="col-value">{{ formatPence(booking.quote_cents) }}</span>
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
          <button class="override-card">
            <span class="material-symbols-outlined override-card__icon">payments</span>
            <span class="override-card__title">Force Refund</span>
            <span class="override-card__desc"
              >Issue full or partial refunds directly to client wallet.</span
            >
          </button>
          <button class="override-card">
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
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { formatDate, formatStatus, formatPence, formatRelativeTime } from '@/utils/format'

const PAGE_SIZE = 10

const TABS = [
  { label: 'All Bookings', value: '' },
  { label: 'Pending', value: 'pending_request' },
  { label: 'Active', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

interface BookingRow {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  service_title_snapshot: string | null
  quote_cents: number
  customer_name: string | null
  cleaner_name: string | null
}

interface BookingQueryRow {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  service_title_snapshot: string | null
  quote_cents: number | null
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
         service_title_snapshot, quote_cents,
         customer:customer_id(full_name),
         cleaner:cleaner_id(full_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(start, end)

    if (activeTab.value) {
      if (activeTab.value === 'pending_request') {
        q = q.in('status', ['pending_request', 'awaiting_customer_payment', 'payment_authorized'])
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
      quote_cents: row.quote_cents ?? 0,
      customer_name: row.customer?.full_name ?? null,
      cleaner_name: row.cleaner?.full_name ?? null,
    }))
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
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
  }
  return map[status] ?? 'calendar_today'
}

function statusBadgeClass(status: string): string {
  if (status === 'in_progress' || status === 'payment_authorized') return 'status-badge--active'
  if (status === 'completed') return 'status-badge--completed'
  if (status === 'cancelled' || status === 'refunded') return 'status-badge--cancelled'
  return 'status-badge--pending'
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
</style>
