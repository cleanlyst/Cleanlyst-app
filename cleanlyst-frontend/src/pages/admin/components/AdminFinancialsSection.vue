<template>
  <div class="bg-background text-on-background antialiased">
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <!-- Header -->
      <section class="space-y-2 mb-8">
        <h1 class="font-h1 text-h1 text-primary">Financial Overview</h1>
        <p class="font-body text-body text-secondary">
          Monitor platform earnings, payout liabilities, and revenue growth metrics.
        </p>
      </section>

      <p v-if="errorMessage" class="mb-6 text-caption text-red-600">{{ errorMessage }}</p>

      <!-- Metrics -->
      <section class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div
          class="p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-2"
        >
          <span class="font-label-md text-label-md text-secondary">Total Revenue (YTD)</span>
          <div class="flex items-baseline gap-2">
            <span class="font-h1 text-h1 text-primary">
              <span v-if="metricsLoading" class="animate-pulse">—</span>
              <span v-else>{{ formatPence(metrics.revenueYtdPence) }}</span>
            </span>
            <span
              v-if="!metricsLoading && metrics.revenueYtdCount > 0"
              class="font-caption text-caption text-secondary"
            >
              {{ metrics.revenueYtdCount }} payments
            </span>
          </div>
        </div>

        <div
          class="p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-2"
        >
          <span class="font-label-md text-label-md text-secondary">Platform Fees (YTD)</span>
          <div class="flex items-baseline gap-2">
            <span class="font-h1 text-h1 text-primary">
              <span v-if="metricsLoading" class="animate-pulse">—</span>
              <span v-else>{{ formatPence(metrics.platformFeeYtdPence) }}</span>
            </span>
          </div>
          <span class="font-caption text-caption text-secondary">Booking fees + commission</span>
        </div>

        <div
          class="p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-2"
        >
          <span class="font-label-md text-label-md text-secondary">Pending Payouts</span>
          <div class="flex items-baseline gap-2">
            <span class="font-h1 text-h1 text-primary">
              <span v-if="metricsLoading" class="animate-pulse">—</span>
              <span v-else>{{ formatPence(metrics.pendingPayoutPence) }}</span>
            </span>
            <span
              v-if="!metricsLoading && metrics.pendingPayoutCleaners > 0"
              class="font-caption text-caption text-secondary"
            >
              {{ metrics.pendingPayoutCleaners }} cleaner{{
                metrics.pendingPayoutCleaners !== 1 ? 's' : ''
              }}
            </span>
          </div>
        </div>
      </section>

      <!-- Revenue Chart -->
      <section
        class="mb-4 border border-outline-variant bg-surface-container-lowest p-padding-card"
      >
        <div class="flex justify-between items-center mb-8">
          <h2 class="font-h2 text-h2 text-primary">Revenue Performance ({{ currentYear }})</h2>
        </div>

        <div
          v-if="chartLoading"
          class="h-[320px] flex items-center justify-center text-caption text-secondary"
        >
          Loading chart…
        </div>
        <div
          v-else-if="chartData.every((v) => v === 0)"
          class="h-[320px] flex items-center justify-center text-caption text-secondary"
        >
          No revenue data for {{ currentYear }} yet.
        </div>
        <div
          v-else
          class="h-[320px] w-full relative bg-surface-container-low flex items-end px-4 gap-4"
        >
          <div
            v-for="(value, i) in chartData"
            :key="i"
            class="flex-1 bg-primary-fixed-dim hover:bg-primary transition-colors relative group"
            :style="{ height: chartBarHeight(value) }"
          >
            <div
              v-if="value > 0"
              class="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface-container text-on-surface text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10"
            >
              {{ formatPence(value) }}
            </div>
          </div>
        </div>

        <div class="flex justify-between mt-4 font-caption text-caption text-secondary">
          <span v-for="month in MONTHS" :key="month">{{ month }}</span>
        </div>
      </section>

      <!-- Recent Transactions -->
      <section class="space-y-4 mb-4">
        <h2 class="font-h2 text-h2 text-primary">Recent Transactions</h2>

        <div class="overflow-x-auto border border-outline-variant bg-surface-container-lowest">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant text-secondary">
                <th class="px-6 py-4 font-label-md text-label-md">Payment ID</th>
                <th class="px-6 py-4 font-label-md text-label-md">Service</th>
                <th class="px-6 py-4 font-label-md text-label-md">Date</th>
                <th class="px-6 py-4 font-label-md text-label-md">Amount</th>
                <th class="px-6 py-4 font-label-md text-label-md">Status</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-outline-variant">
              <tr v-if="txLoading">
                <td colspan="5" class="px-6 py-12 text-center text-caption text-secondary">
                  Loading…
                </td>
              </tr>
              <tr v-else-if="transactions.length === 0">
                <td colspan="5" class="px-6 py-12 text-center text-caption text-secondary">
                  No transactions yet.
                </td>
              </tr>
              <tr
                v-else
                v-for="tx in transactions"
                :key="tx.paymentId"
                class="hover:bg-surface-container-low transition-colors cursor-pointer"
                @click="openTransactionDetail(tx)"
              >
                <td class="px-6 py-4 font-label-md text-body text-primary font-mono text-sm">
                  {{ shortId(tx.paymentId) }}
                </td>
                <td class="px-6 py-4 font-body text-body text-secondary">
                  {{ tx.serviceTitle ?? '—' }}
                </td>
                <td class="px-6 py-4 font-body text-body text-secondary">
                  {{ formatDate(tx.createdAt) }}
                </td>
                <td class="px-6 py-4 font-label-md text-body text-primary">
                  {{ formatPence(tx.amountCents) }}
                </td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'flex items-center gap-1.5 font-caption text-caption',
                      tx.paymentStatus === 'released'
                        ? 'text-green-700'
                        : tx.paymentStatus === 'refunded' || tx.paymentStatus === 'failed'
                          ? 'text-red-600'
                          : 'text-secondary',
                    ]"
                  >
                    <span
                      :class="[
                        'w-1.5 h-1.5 rounded-full',
                        tx.paymentStatus === 'released'
                          ? 'bg-green-600'
                          : tx.paymentStatus === 'refunded' || tx.paymentStatus === 'failed'
                            ? 'bg-error'
                            : 'bg-outline',
                      ]"
                    ></span>
                    {{ txStatusLabel(tx.paymentStatus) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <!-- Transaction Detail Modal -->
  <AppModal v-model="showDetail" title="Transaction Detail" size="lg">
    <div v-if="selectedTx" class="tx-detail">
      <div class="tx-detail-grid">
        <div class="tx-detail-row">
          <span class="tx-detail-label">Transaction ID</span>
          <span class="tx-detail-value font-mono">{{ shortId(selectedTx.paymentId) }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Booking ID</span>
          <span class="tx-detail-value font-mono">{{ shortId(selectedTx.bookingId) }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Customer</span>
          <span class="tx-detail-value">{{ selectedTx.customerName ?? '—' }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Cleaner</span>
          <span class="tx-detail-value">{{ selectedTx.cleanerName ?? '—' }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Service</span>
          <span class="tx-detail-value">{{ selectedTx.serviceTitle ?? '—' }}</span>
        </div>
      </div>

      <div class="tx-detail-divider"></div>

      <div class="tx-detail-breakdown">
        <h3 class="tx-detail-section-title">Breakdown</h3>
        <div class="tx-detail-breakdown-rows">
          <div class="tx-detail-breakdown-row">
            <span>Cleaning Fee</span>
            <span>{{ formatPence(selectedTx.servicePriceCents) }}</span>
          </div>
          <div class="tx-detail-breakdown-row">
            <span>Booking Fee</span>
            <span>{{ formatPence(selectedTx.bookingFeeCents) }}</span>
          </div>
          <div class="tx-detail-breakdown-row tx-detail-breakdown-row--total">
            <span>Total Customer Paid</span>
            <span>{{ formatPence(selectedTx.amountCents) }}</span>
          </div>
        </div>
        <div class="tx-detail-breakdown-rows" style="margin-top: 1rem;">
          <div class="tx-detail-breakdown-row tx-detail-breakdown-row--deduct">
            <span>Commission Deducted</span>
            <span>{{ formatPence(selectedTx.commissionCents) }}</span>
          </div>
          <div class="tx-detail-breakdown-row">
            <span>Cleaner Payout</span>
            <span>{{ formatPence(selectedTx.cleanerPayoutCents) }}</span>
          </div>
          <div class="tx-detail-breakdown-row tx-detail-breakdown-row--platform">
            <span>Platform Revenue</span>
            <span>{{ formatPence(selectedTx.bookingFeeCents + selectedTx.commissionCents) }}</span>
          </div>
        </div>
      </div>

      <div class="tx-detail-divider"></div>

      <div class="tx-detail-grid">
        <div class="tx-detail-row">
          <span class="tx-detail-label">Payment Status</span>
          <span class="tx-detail-value">{{ txStatusLabel(selectedTx.paymentStatus) }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Booking Status</span>
          <span class="tx-detail-value">{{ formatStatus(selectedTx.bookingStatus ?? '') }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Created</span>
          <span class="tx-detail-value">{{ formatDate(selectedTx.createdAt) }}</span>
        </div>
        <div class="tx-detail-row">
          <span class="tx-detail-label">Completed</span>
          <span class="tx-detail-value">{{
            selectedTx.completedAt ? formatDate(selectedTx.completedAt) : '—'
          }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <button
        class="px-4 py-2 border border-outline-variant text-label-md text-primary hover:bg-surface-container transition-colors"
        type="button"
        @click="showDetail = false"
      >
        Close
      </button>
    </template>
  </AppModal>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { formatPence, formatDate, formatStatus } from '@/utils/format'
import AppModal from '@/components/ui/AppModal.vue'
import {
  getAdminFinancialMetrics,
  getAdminTransactions,
  getAdminRevenueChart,
  type AdminFinancialMetrics,
  type AdminTransactionRow,
} from '@/services/financialService'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const currentYear = new Date().getFullYear()

const metricsLoading = ref(true)
const chartLoading = ref(true)
const txLoading = ref(true)
const errorMessage = ref('')

const metrics = ref<AdminFinancialMetrics>({
  revenueYtdPence: 0,
  revenueYtdCount: 0,
  platformFeeYtdPence: 0,
  pendingPayoutPence: 0,
  pendingPayoutCleaners: 0,
})

const chartData = ref<number[]>(Array(12).fill(0))
const transactions = ref<AdminTransactionRow[]>([])

const showDetail = ref(false)
const selectedTx = ref<AdminTransactionRow | null>(null)

let paymentsChannel: ReturnType<ReturnType<typeof requireSupabase>['channel']> | null = null

onMounted(async () => {
  await Promise.all([loadMetrics(), loadChart(), loadTransactions()])

  const supabase = requireSupabase()
  paymentsChannel = supabase
    .channel('admin-financials-payments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
      loadMetrics()
      loadChart()
      loadTransactions()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payouts' }, () => {
      loadMetrics()
    })
    .subscribe()
})

onBeforeUnmount(() => {
  paymentsChannel?.unsubscribe()
})

async function loadMetrics() {
  metricsLoading.value = true
  try {
    const ytdStart = `${currentYear}-01-01T00:00:00Z`
    metrics.value = await getAdminFinancialMetrics(ytdStart)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load financial metrics.'
  } finally {
    metricsLoading.value = false
  }
}

async function loadChart() {
  chartLoading.value = true
  try {
    chartData.value = await getAdminRevenueChart(currentYear)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load chart data.'
  } finally {
    chartLoading.value = false
  }
}

async function loadTransactions() {
  txLoading.value = true
  try {
    transactions.value = await getAdminTransactions(10)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load transactions.'
  } finally {
    txLoading.value = false
  }
}

function openTransactionDetail(tx: AdminTransactionRow) {
  selectedTx.value = tx
  showDetail.value = true
}

function chartBarHeight(value: number): string {
  const max = Math.max(...chartData.value, 1)
  const pct = Math.round((value / max) * 100)
  return pct < 2 ? '2%' : `${pct}%`
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function txStatusLabel(status: string): string {
  const map: Record<string, string> = {
    captured: 'Paid',
    released: 'Released',
    authorized: 'Authorized',
    unpaid: 'Unpaid',
    refunded: 'Refunded',
    failed: 'Failed',
  }
  return map[status] ?? formatStatus(status)
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* ── Transaction detail modal ────────────────────────────── */
.tx-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tx-detail-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tx-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.tx-detail-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.tx-detail-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
  text-align: right;
}

.tx-detail-divider {
  border-top: 1px solid var(--outline-variant, #c4c7c7);
}

.tx-detail-section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.75rem;
}

.tx-detail-breakdown-rows {
  background: var(--surface-container, #eeeeee);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tx-detail-breakdown-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--primary, #000000);
}

.tx-detail-breakdown-row--total {
  font-weight: 700;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  padding-top: 0.5rem;
  margin-top: 0.25rem;
}

.tx-detail-breakdown-row--deduct {
  color: var(--secondary, #5e5e5e);
}

.tx-detail-breakdown-row--platform {
  font-weight: 600;
  color: var(--primary, #000000);
}
</style>
