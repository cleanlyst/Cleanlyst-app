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
                <th class="px-6 py-4 font-label-md text-label-md">Date</th>
                <th class="px-6 py-4 font-label-md text-label-md">Amount</th>
                <th class="px-6 py-4 font-label-md text-label-md">Type</th>
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
                :key="tx.id"
                class="hover:bg-surface-container-low transition-colors"
              >
                <td class="px-6 py-4 font-label-md text-body text-primary font-mono text-sm">
                  {{ shortId(tx.id) }}
                </td>
                <td class="px-6 py-4 font-body text-body text-secondary">
                  {{ formatDate(tx.created_at) }}
                </td>
                <td class="px-6 py-4 font-label-md text-body text-primary">
                  {{ formatPence(tx.amount_cents) }}
                </td>
                <td class="px-6 py-4">
                  <span
                    class="px-2 py-1 bg-surface-container-high font-caption text-caption rounded"
                  >
                    {{ formatStatus(tx.status) }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'flex items-center gap-1.5 font-caption text-caption',
                      tx.status === 'released'
                        ? 'text-green-700'
                        : tx.status === 'refunded' || tx.status === 'failed'
                          ? 'text-red-600'
                          : 'text-secondary',
                    ]"
                  >
                    <span
                      :class="[
                        'w-1.5 h-1.5 rounded-full',
                        tx.status === 'released'
                          ? 'bg-green-600'
                          : tx.status === 'refunded' || tx.status === 'failed'
                            ? 'bg-error'
                            : 'bg-outline',
                      ]"
                    ></span>
                    {{ txStatusLabel(tx.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { formatPence, formatDate, formatStatus } from '@/utils/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const currentYear = new Date().getFullYear()

interface FinancialMetrics {
  revenueYtdPence: number
  revenueYtdCount: number
  platformFeeYtdPence: number
  pendingPayoutPence: number
  pendingPayoutCleaners: number
}

interface AmountRow {
  amount_cents: number | null
}

interface Transaction {
  id: string
  amount_cents: number
  status: string
  created_at: string
}

const metricsLoading = ref(true)
const chartLoading = ref(true)
const txLoading = ref(true)
const errorMessage = ref('')

const metrics = ref<FinancialMetrics>({
  revenueYtdPence: 0,
  revenueYtdCount: 0,
  platformFeeYtdPence: 0,
  pendingPayoutPence: 0,
  pendingPayoutCleaners: 0,
})

const chartData = ref<number[]>(Array(12).fill(0))
const transactions = ref<Transaction[]>([])

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
    .subscribe()
})

onBeforeUnmount(() => {
  paymentsChannel?.unsubscribe()
})

async function loadMetrics() {
  metricsLoading.value = true
  try {
    const supabase = requireSupabase()
    const ytdStart = `${currentYear}-01-01T00:00:00Z`

    const [paymentsResult, releasedFeesResult] = await Promise.all([
      supabase
        .from('payments')
        .select('amount_cents')
        .in('status', ['captured', 'released'])
        .gte('created_at', ytdStart),
      supabase
        .from('payments')
        .select('platform_fee_cents, cleaner_payout_cents')
        .eq('status', 'released')
        .gte('created_at', ytdStart),
    ])

    const allPayments = (paymentsResult.data ?? []) as AmountRow[]
    const revenueYtdPence = allPayments.reduce((s: number, r) => s + (r.amount_cents ?? 0), 0)

    const releasedFees = (releasedFeesResult.data ?? []) as Array<{ platform_fee_cents: number | null; cleaner_payout_cents: number | null }>
    const platformFeeYtdPence = releasedFees.reduce((s: number, r) => s + (r.platform_fee_cents ?? 0), 0)
    const pendingPayoutPence = releasedFees.reduce((s: number, r) => s + (r.cleaner_payout_cents ?? 0), 0)

    metrics.value = {
      revenueYtdPence,
      revenueYtdCount: allPayments.length,
      platformFeeYtdPence,
      pendingPayoutPence,
      pendingPayoutCleaners: 0,
    }
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load financial metrics.'
  } finally {
    metricsLoading.value = false
  }
}

async function loadChart() {
  chartLoading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('payments')
      .select('amount_cents, captured_at, created_at')
      .in('status', ['captured', 'released'])
      .gte('created_at', `${currentYear}-01-01T00:00:00Z`)
      .lt('created_at', `${currentYear + 1}-01-01T00:00:00Z`)

    if (error) throw error

    const monthly = Array(12).fill(0) as number[]
    for (const row of data ?? []) {
      const dateStr = row.captured_at ?? row.created_at
      if (dateStr) {
        const month = new Date(dateStr).getMonth()
        monthly[month] += row.amount_cents ?? 0
      }
    }
    chartData.value = monthly
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load chart data.'
  } finally {
    chartLoading.value = false
  }
}

async function loadTransactions() {
  txLoading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount_cents, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    transactions.value = (data ?? []) as Transaction[]
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load transactions.'
  } finally {
    txLoading.value = false
  }
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
</style>
