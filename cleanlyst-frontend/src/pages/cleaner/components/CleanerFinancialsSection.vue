<template>
  <main class="page-main">
    <section class="page-header">
      <div>
        <h1 class="header-title">Financials</h1>
        <p class="header-copy">Your earnings overview and recent payment history.</p>
      </div>
    </section>

    <!-- Summary Cards -->
    <section class="earnings-grid">
      <div class="earnings-card">
        <div>
          <span class="metric-label">Total Earnings</span>
          <h2 class="metric-value-xl">{{ earningsToDate }}</h2>
        </div>
        <div class="metric-footer">
          <span class="metric-footer-text">Based on completed jobs</span>
          <span class="metric-footer-sub">based on actual payouts</span>
        </div>
      </div>

      <div class="metric-card">
        <span class="metric-label">This Month</span>
        <h2 class="metric-value">{{ thisMonthEarnings }}</h2>
        <p class="metric-sub">{{ thisMonthCompleted }} jobs completed</p>
      </div>

      <div class="metric-card">
        <span class="metric-label">Pending Payout</span>
        <h2 class="metric-value">{{ pendingEarnings }}</h2>
        <p class="metric-sub">{{ upcomingCount }} upcoming jobs</p>
      </div>

      <div class="metric-card">
        <span class="metric-label">Avg per Job</span>
        <h2 class="metric-value">{{ avgPerJob }}</h2>
        <p class="metric-sub">Across completed jobs</p>
      </div>
    </section>

    <!-- Recent Transactions -->
    <section class="transactions-section">
      <h2 class="section-title">Recent Earnings</h2>

      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading transactions…</p>
      </div>

      <div v-else-if="recentBookings.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">receipt_long</span>
        <p class="empty-label">No transactions yet</p>
        <p class="empty-desc">Completed bookings will appear here.</p>
      </div>

      <div v-else class="transaction-list">
        <div class="transaction-list-header">
          <span class="th-label">Service</span>
          <span class="th-label">Date</span>
          <span class="th-label th-label--right">Service price</span>
          <span class="th-label th-label--right">Commission</span>
          <span class="th-label th-label--right">Net payout</span>
          <span class="th-label">Status</span>
        </div>
        <div
          v-for="b in recentBookings"
          :key="b.bookingId"
          class="transaction-row"
          style="cursor: pointer;"
          @click="openTxDetail(b)"
        >
          <div class="tx-service">
            <span class="material-symbols-outlined tx-icon">cleaning_services</span>
            {{ b.serviceTitle ?? 'Cleaning Booking' }}
          </div>
          <div class="tx-date">{{ formatDate(b.scheduledStart) }}</div>
          <div class="tx-amount">{{ b.servicePriceCents != null ? formatCurrencyVal(b.servicePriceCents) : '—' }}</div>
          <div class="tx-amount tx-amount--deducted">{{ b.commissionCents != null ? '− ' + formatCurrencyVal(b.commissionCents) : '—' }}</div>
          <div class="tx-amount">{{ b.cleanerPayoutCents != null ? formatCurrencyVal(b.cleanerPayoutCents) : '—' }}</div>
          <div class="tx-status">
            <span class="status-pill" :class="txStatusClass(b.bookingStatus)">
              {{ txStatusLabel(b.bookingStatus) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Payout Info -->
    <section class="payout-section">
      <h2 class="section-title">Payout Information</h2>
      <div class="payout-card">
        <div class="payout-row">
          <div class="payout-col">
            <p class="payout-label">Payout Method</p>
            <p class="payout-value">Bank Transfer</p>
          </div>
          <div class="payout-col">
            <p class="payout-label">Payout Schedule</p>
            <p class="payout-value">Weekly (every Monday)</p>
          </div>
          <div class="payout-col">
            <p class="payout-label">Currency</p>
            <p class="payout-value">{{ currency }}</p>
          </div>
        </div>
        <p class="payout-hint">
          To update your bank details or payout schedule, please contact support.
        </p>
      </div>
    </section>
  </main>

  <!-- Transaction Detail Modal -->
  <AppModal v-model="showTxDetail" title="Earnings Detail" size="md">
    <div v-if="selectedTx" class="tx-detail">
      <div class="tx-detail-grid">
        <div class="tx-detail-row">
          <span class="tx-detail-label">Transaction ID</span>
          <span class="tx-detail-value font-mono"
            >#{{ selectedTx.bookingId.slice(0, 8).toUpperCase() }}</span
          >
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Service</span>
          <span class="tx-detail-value">{{ selectedTx.serviceTitle ?? '—' }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Customer</span>
          <span class="tx-detail-value">{{ selectedTx.customerName ?? '—' }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Completed</span>
          <span class="tx-detail-value">{{
            selectedTx.completedAt ? formatDate(selectedTx.completedAt) : '—'
          }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Payment Status</span>
          <span class="tx-detail-value">{{ selectedTx.paymentStatus ?? '—' }}</span>
        </div>
      </div>

      <div class="tx-detail-divider"></div>

      <div class="tx-detail-breakdown-rows">
        <div class="tx-detail-breakdown-row">
          <span>Cleaning Fee</span>
          <span>{{
            selectedTx.servicePriceCents != null
              ? formatCurrencyVal(selectedTx.servicePriceCents)
              : '—'
          }}</span>
        </div>
        <div class="tx-detail-breakdown-row tx-detail-breakdown-row--deduct">
          <span>Commission Deduction</span>
          <span>{{
            selectedTx.commissionCents != null
              ? '− ' + formatCurrencyVal(selectedTx.commissionCents)
              : '—'
          }}</span>
        </div>
        <div class="tx-detail-breakdown-row tx-detail-breakdown-row--total">
          <span>Net Earnings</span>
          <span>{{
            selectedTx.cleanerPayoutCents != null
              ? formatCurrencyVal(selectedTx.cleanerPayoutCents)
              : '—'
          }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-modal-close" type="button" @click="showTxDetail = false">Close</button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RealtimeSubscription } from '@/lib/realtime'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { subscribeToTable, unsubscribe } from '@/lib/realtime'
import AppModal from '@/components/ui/AppModal.vue'
import { getCleanerTransactions, type CleanerTransactionRow } from '@/services/financialService'

const auth = useAuthStore()
const loading = ref(true)
const totalEarningsCents = ref(0)
const thisMonthEarningsCents = ref(0)
const pendingPayoutCents = ref(0)
const recentBookings = ref<CleanerTransactionRow[]>([])
const realtimeChannel = ref<RealtimeSubscription | null>(null)
const showTxDetail = ref(false)
const selectedTx = ref<CleanerTransactionRow | null>(null)

const currency = computed(() => auth.cleanerProfile?.currency ?? 'GBP')

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.value,
  }).format(cents / 100)
}

const earningsToDate = computed(() => formatCurrency(totalEarningsCents.value))
const thisMonthEarnings = computed(() => formatCurrency(thisMonthEarningsCents.value))
const pendingEarnings = computed(() => formatCurrency(pendingPayoutCents.value))

const thisMonthCompleted = computed(
  () => recentBookings.value.filter((b) => b.bookingStatus === 'completed').length,
)

const upcomingCount = computed(
  () =>
    recentBookings.value.filter((b) =>
      ['awaiting_customer_payment', 'payment_authorized', 'in_progress'].includes(b.bookingStatus),
    ).length,
)

const avgPerJob = computed(() => {
  const paid = recentBookings.value.filter(
    (b) => b.bookingStatus === 'completed' && b.cleanerPayoutCents,
  )
  if (paid.length === 0) return formatCurrency(0)
  const total = paid.reduce((sum, b) => sum + (b.cleanerPayoutCents ?? 0), 0)
  return formatCurrency(Math.round(total / paid.length))
})

function formatCurrencyVal(cents: number | null | undefined): string {
  return cents != null ? formatCurrency(cents) : '—'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

function txStatusClass(status: string): string {
  if (status === 'completed') return 'status-pill--completed'
  if (['in_progress', 'payment_authorized'].includes(status)) return 'status-pill--active'
  if (['cancelled', 'cleaner_declined', 'disputed', 'refunded'].includes(status))
    return 'status-pill--cancelled'
  return 'status-pill--pending'
}

function txStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: 'Paid',
    payment_authorized: 'Authorized',
    in_progress: 'In Progress',
    cancelled: 'Cancelled',
    cleaner_declined: 'Declined',
    disputed: 'Disputed',
    refunded: 'Refunded',
  }
  return map[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

async function loadFinancials() {
  if (!auth.initialized) await auth.init()
  if (!auth.userId) {
    loading.value = false
    return
  }

  const supabase = requireSupabase()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [allCompletedResult, monthCompletedResult, pendingResult, recentRows] = await Promise.all([
    // Use booking_financials as source so totals match cleaner_earnings_ledger exactly.
    supabase
      .from('bookings')
      .select('booking_financials(cleaner_payout_cents)')
      .eq('cleaner_id', auth.userId)
      .eq('status', 'completed'),

    supabase
      .from('bookings')
      .select('booking_financials(cleaner_payout_cents)')
      .eq('cleaner_id', auth.userId)
      .eq('status', 'completed')
      .gte('scheduled_start', startOfMonth),

    // Pending (no ledger row yet) — use bookings snapshot directly.
    supabase
      .from('bookings')
      .select('cleaner_payout_cents')
      .eq('cleaner_id', auth.userId)
      .in('status', [
        'estimate_proposed',
        'awaiting_customer_payment',
        'payment_authorized',
        'in_progress',
        'completion_pending_customer',
      ]),

    getCleanerTransactions(auth.userId!),
  ])

  type BfRow = { booking_financials: { cleaner_payout_cents: number | null } | Array<{ cleaner_payout_cents: number | null }> | null }
  const extractPayout = (b: BfRow) => {
    const bf = Array.isArray(b.booking_financials) ? b.booking_financials[0] : b.booking_financials
    return bf?.cleaner_payout_cents ?? 0
  }

  totalEarningsCents.value = (allCompletedResult.data ?? [] as BfRow[]).reduce(
    (sum, b) => sum + extractPayout(b as BfRow),
    0,
  )
  thisMonthEarningsCents.value = (monthCompletedResult.data ?? [] as BfRow[]).reduce(
    (sum, b) => sum + extractPayout(b as BfRow),
    0,
  )
  pendingPayoutCents.value = (pendingResult.data ?? []).reduce(
    (sum, b) => sum + ((b as { cleaner_payout_cents: number | null }).cleaner_payout_cents ?? 0),
    0,
  )
  recentBookings.value = recentRows
  loading.value = false
}

function openTxDetail(b: CleanerTransactionRow) {
  selectedTx.value = b
  showTxDetail.value = true
}

onMounted(async () => {
  await loadFinancials()
  if (auth.userId && !realtimeChannel.value) {
    realtimeChannel.value = subscribeToTable('cleaner-financials-bookings', {
      table: 'bookings',
      event: 'UPDATE',
      filter: `cleaner_id=eq.${auth.userId}`,
      onData: () => loadFinancials(),
    })
  }
})

onBeforeUnmount(() => unsubscribe(realtimeChannel.value))
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

/* ── Earnings grid ────────────────────────────────────────────── */
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

/* ── Earnings card (wide) ─────────────────────────────────────── */
.earnings-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
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
  line-height: 1.4;
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
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
}

.metric-footer-sub {
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
  font-style: italic;
}

/* ── Metric cards ─────────────────────────────────────────────── */
.metric-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin-top: 0.5rem;
}

.metric-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
  margin-top: 0.25rem;
}

/* ── Transactions ─────────────────────────────────────────────── */
.transactions-section {
  margin-bottom: 4rem;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin-bottom: 1.5rem;
}

/* ── Loading ──────────────────────────────────────────────────── */
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
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Transaction list ─────────────────────────────────────────── */
.transaction-list {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
}

.transaction-list-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1fr;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: var(--surface-container, #eeeeee);
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.th-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
}

.th-label--right {
  text-align: right;
}

.transaction-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1fr;
  gap: 1rem;
  padding: 1rem 1.5rem;
  align-items: center;
  border-bottom: 1px solid var(--surface-variant, #e2e2e2);
  transition: background-color 0.1s;
}

.transaction-row:last-child {
  border-bottom: none;
}

.transaction-row:hover {
  background-color: var(--surface-container, #eeeeee);
}

.tx-service {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
}

.tx-icon {
  font-size: 1rem;
  color: var(--secondary, #5e5e5e);
  flex-shrink: 0;
}

.tx-date {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
}

.tx-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary, #000000);
  text-align: right;
}

.tx-amount--deducted {
  color: #c62828;
}

.tx-status {
  display: flex;
  align-items: center;
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

/* ── Payout section ───────────────────────────────────────────── */
.payout-section {
  margin-top: 4rem;
}

.payout-card {
  padding: 1.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
}

.payout-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

@media (min-width: 640px) {
  .payout-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

.payout-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.payout-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.payout-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0;
}

.payout-hint {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  padding-top: 1rem;
  margin: 0;
}

@media (max-width: 640px) {
  .transaction-list-header,
  .transaction-row {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .th-label:nth-child(2),
  .th-label:nth-child(3),
  .tx-date,
  .transaction-row > .tx-amount:first-of-type {
    display: none;
  }
}

/* ── Transaction detail modal ─────────────────────────────────── */
.tx-detail {
  padding: 0.25rem 0;
}

.tx-detail-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tx-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.tx-detail-label {
  color: var(--secondary, #5e5e5e);
  font-weight: 400;
}

.tx-detail-value {
  color: var(--primary, #000000);
  font-weight: 500;
  text-align: right;
}

.font-mono {
  font-family: monospace;
}

.tx-detail-divider {
  border: none;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  margin: 1.25rem 0;
}

.tx-detail-breakdown-rows {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.tx-detail-breakdown-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
}

.tx-detail-breakdown-row--deduct {
  color: #c62828;
}

.tx-detail-breakdown-row--total {
  font-size: 16px;
  font-weight: 700;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  margin-top: 0.25rem;
}

.btn-modal-close {
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  color: var(--primary, #000000);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: background-color 0.1s;
}

.btn-modal-close:hover {
  background-color: var(--surface-container, #eeeeee);
}
</style>
