<template>
  <DashboardLayout :links="adminDashboardLinks">
    <div class="bg-background text-on-background antialiased">
      <main class="flex-grow p-6 lg:p-10 overflow-x-hidden max-w-7xl mx-auto">

        <!-- Header -->
        <div class="mb-6">
          <h1 class="font-h2 text-h2 text-on-surface mb-1">Financial Close</h1>
          <p class="font-body-md text-body-md text-secondary">
            Run period-end reconciliation closes and export reports.
          </p>
        </div>

        <!-- Run close panel -->
        <div class="border border-outline-variant bg-surface-container-lowest rounded-md p-padding-card mb-8">
          <h2 class="font-title-lg text-title-lg text-on-surface mb-4">Run New Close</h2>

          <div class="flex flex-wrap gap-3 mb-4">
            <button
              v-for="type in periodTypes"
              :key="type.value"
              :disabled="running"
              class="flex items-center gap-1.5 px-4 py-2 rounded-md border font-label-md text-label-md transition-colors disabled:opacity-50"
              :class="selectedPeriodType === type.value
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline text-on-surface hover:bg-surface-container'"
              @click="selectedPeriodType = type.value"
            >
              <span class="material-symbols-outlined text-base">{{ type.icon }}</span>
              {{ type.label }}
            </button>
          </div>

          <!-- Manual date range -->
          <div v-if="selectedPeriodType === 'manual'" class="flex gap-3 flex-wrap mb-4">
            <div class="flex flex-col gap-1">
              <label for="manual-start-date" class="font-label-sm text-label-sm text-secondary">Start date</label>
              <input
                id="manual-start-date"
                v-model="manualStart"
                type="date"
                class="border border-outline rounded-md px-3 py-2 text-sm bg-surface text-on-surface"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label for="manual-end-date" class="font-label-sm text-label-sm text-secondary">End date</label>
              <input
                id="manual-end-date"
                v-model="manualEnd"
                type="date"
                class="border border-outline rounded-md px-3 py-2 text-sm bg-surface text-on-surface"
              />
            </div>
          </div>

          <!-- Date picker for daily/weekly -->
          <div v-if="selectedPeriodType === 'daily' || selectedPeriodType === 'weekly'" class="mb-4">
            <label for="period-date" class="font-label-sm text-label-sm text-secondary block mb-1">
              {{ selectedPeriodType === 'daily' ? 'Date' : 'Week containing date' }}
            </label>
            <input
              id="period-date"
              v-model="selectedDate"
              type="date"
              class="border border-outline rounded-md px-3 py-2 text-sm bg-surface text-on-surface"
            />
          </div>

          <div class="flex items-center gap-3">
            <button
              :disabled="running || !canRun"
              class="flex items-center gap-2 px-6 py-2.5 rounded-md bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              @click="handleRun"
            >
              <span v-if="running" class="material-symbols-outlined text-base animate-spin">sync</span>
              <span v-else class="material-symbols-outlined text-base">play_circle</span>
              {{ running ? 'Running…' : 'Run Close' }}
            </button>
            <p v-if="runError" class="text-error font-body-sm text-body-sm">{{ runError }}</p>
          </div>
        </div>

        <!-- Selected close detail -->
        <template v-if="selectedClose">
          <div class="border border-outline-variant bg-surface-container-lowest rounded-md p-padding-card mb-8">
            <div class="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 class="font-title-lg text-title-lg text-on-surface">
                  {{ selectedClose.report?.periodType ?? selectedClose.periodType }} Close
                  · {{ selectedClose.report?.periodStart?.slice(0,10) }}
                  → {{ selectedClose.report?.periodEnd?.slice(0,10) }}
                </h2>
                <span
                  class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase"
                  :class="closeStatusColor(selectedClose.status)"
                >
                  <span class="material-symbols-outlined text-xs">{{ closeStatusIcon(selectedClose.status) }}</span>
                  {{ selectedClose.status }}
                  <span v-if="selectedClose.isRerun" class="ml-1 opacity-70">(re-run)</span>
                </span>
              </div>

              <!-- Export buttons -->
              <div class="flex gap-2 flex-wrap">
                <button
                  class="flex items-center gap-1 px-3 py-1.5 text-sm border border-outline rounded-md hover:bg-surface-container transition-colors"
                  @click="downloadCSV(selectedClose)"
                >
                  <span class="material-symbols-outlined text-base">download</span>
                  CSV
                </button>
                <button
                  v-if="selectedClose.report?.discrepancies?.length"
                  class="flex items-center gap-1 px-3 py-1.5 text-sm border border-outline rounded-md hover:bg-surface-container transition-colors"
                  @click="downloadDiscrepanciesCSV(selectedClose)"
                >
                  <span class="material-symbols-outlined text-base">download</span>
                  Discrepancies
                </button>
                <button
                  class="flex items-center gap-1 px-3 py-1.5 text-sm border border-outline rounded-md hover:bg-surface-container transition-colors"
                  @click="downloadJSON(selectedClose)"
                >
                  <span class="material-symbols-outlined text-base">code</span>
                  JSON
                </button>
                <button
                  class="flex items-center gap-1 px-3 py-1.5 text-sm border border-outline rounded-md hover:bg-surface-container transition-colors"
                  @click="printPDF(selectedClose)"
                >
                  <span class="material-symbols-outlined text-base">print</span>
                  Print
                </button>
              </div>
            </div>

            <template v-if="selectedClose.report">
              <!-- Blocking issues -->
              <div v-if="selectedClose.report.blockingIssues.length" class="mb-4 p-3 bg-error-container text-on-error-container rounded-md">
                <p class="font-label-md text-label-md mb-1 flex items-center gap-1">
                  <span class="material-symbols-outlined text-base">block</span>
                  Close blocked — resolve these issues first:
                </p>
                <ul class="list-disc list-inside text-sm space-y-0.5">
                  <li v-for="issue in selectedClose.report.blockingIssues" :key="issue">{{ issue }}</li>
                </ul>
              </div>

              <!-- Warnings -->
              <div v-if="selectedClose.report.warnings.length" class="mb-4 p-3 bg-primary-container text-on-primary-container rounded-md">
                <p class="font-label-md text-label-md mb-1 flex items-center gap-1">
                  <span class="material-symbols-outlined text-base">warning</span>
                  Warnings:
                </p>
                <ul class="list-disc list-inside text-sm space-y-0.5">
                  <li v-for="w in selectedClose.report.warnings" :key="w">{{ w }}</li>
                </ul>
              </div>

              <!-- Metrics grid -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-6">
                <MetricCard label="Gross Revenue"    :value="formatPence(selectedClose.report.grossRevenueCents)" />
                <MetricCard label="Net Revenue"      :value="formatPence(selectedClose.report.netRevenueCents)" />
                <MetricCard label="Total Refunds"    :value="formatPence(selectedClose.report.totalRefundsCents)" />
                <MetricCard label="Cleaner Payouts"  :value="formatPence(selectedClose.report.cleanerPayoutsCents)" />
                <MetricCard label="Bookings Created" :value="String(selectedClose.report.bookingsCreated)" />
                <MetricCard label="Completed"        :value="String(selectedClose.report.bookingsCompleted)" />
                <MetricCard label="Captured Payments" :value="String(selectedClose.report.capturedPayments)" />
                <MetricCard label="Refunded Payments" :value="String(selectedClose.report.refundedPayments)" />
              </div>

              <!-- Cash position -->
              <div class="border border-outline-variant rounded-md overflow-hidden mb-6">
                <p class="px-padding-card py-2 bg-surface-container font-label-md text-label-md text-secondary border-b border-outline-variant">Cash Position</p>
                <div class="divide-y divide-outline-variant/50">
                  <CashRow label="Cash Received"    :value="formatPence(selectedClose.report.totals.cashReceivedCents)" />
                  <CashRow label="Cash Paid Out"    :value="formatPence(selectedClose.report.totals.cashPaidOutCents)" />
                  <CashRow label="Ledger Balance"   :value="formatPence(selectedClose.report.totals.ledgerBalanceCents)" bold />
                  <CashRow label="Refund Liability" :value="formatPence(selectedClose.report.totals.refundLiabilityCents)" />
                  <CashRow label="Pending Liability" :value="formatPence(selectedClose.report.totals.pendingLiabilityCents)" />
                </div>
              </div>

              <!-- Reconciliation summary -->
              <div class="border border-outline-variant rounded-md overflow-hidden mb-6">
                <p class="px-padding-card py-2 bg-surface-container font-label-md text-label-md text-secondary border-b border-outline-variant">Reconciliation</p>
                <div class="divide-y divide-outline-variant/50">
                  <CashRow label="Bookings Scanned"     :value="String(selectedClose.report.reconciliation.totalBookingsScanned)" />
                  <CashRow label="Ledger Mismatches"    :value="String(selectedClose.report.reconciliation.ledgerMismatches)"    :error="selectedClose.report.reconciliation.ledgerMismatches > 0" />
                  <CashRow label="Integrity Violations" :value="String(selectedClose.report.reconciliation.integrityViolations)"  :error="selectedClose.report.reconciliation.integrityViolations > 0" />
                  <CashRow label="Duplicate Events"     :value="String(selectedClose.report.reconciliation.duplicateStripeEvents)" :error="selectedClose.report.reconciliation.duplicateStripeEvents > 0" />
                </div>
              </div>

              <!-- Discrepancies table -->
              <div v-if="selectedClose.report.discrepancies.length" class="border border-outline-variant rounded-md overflow-x-auto">
                <p class="px-padding-card py-2 bg-surface-container font-label-md text-label-md text-secondary border-b border-outline-variant">
                  Discrepancies ({{ selectedClose.report.discrepancies.length }})
                </p>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-outline-variant">
                      <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Booking</th>
                      <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Type</th>
                      <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Severity</th>
                      <th class="text-left py-2 px-3 font-label-sm text-label-sm text-secondary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="d in selectedClose.report.discrepancies"
                      :key="d.bookingId + d.type"
                      class="border-b border-outline-variant/50"
                    >
                      <td class="py-2 px-3 font-mono text-xs">{{ d.bookingId.slice(0,8) }}…</td>
                      <td class="py-2 px-3 text-xs">{{ d.type.replace(/_/g, ' ') }}</td>
                      <td class="py-2 px-3">
                        <span
                          class="px-1.5 py-0.5 rounded text-xs font-semibold"
                          :class="d.severity === 'violation'
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-primary-container text-on-primary-container'"
                        >{{ d.severity }}</span>
                      </td>
                      <td class="py-2 px-3 text-xs text-secondary">{{ d.description }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </template>

        <!-- Close history -->
        <div class="border border-outline-variant bg-surface-container-lowest rounded-md overflow-hidden">
          <div class="flex items-center justify-between px-padding-card py-3 border-b border-outline-variant">
            <h2 class="font-title-md text-title-md text-on-surface">History</h2>
            <button
              class="text-secondary font-label-sm text-label-sm hover:text-primary transition-colors flex items-center gap-1"
              @click="fetchHistory()"
            >
              <span class="material-symbols-outlined text-base">refresh</span>
              Refresh
            </button>
          </div>
          <div v-if="loadingHistory" class="p-4 text-secondary font-body-sm text-body-sm animate-pulse">Loading…</div>
          <div v-else-if="!history.length" class="p-4 text-secondary font-body-sm text-body-sm">No closes recorded yet.</div>
          <div v-else class="divide-y divide-outline-variant/50">
            <button
              v-for="close in history"
              :key="close.id"
              class="w-full text-left px-padding-card py-3 hover:bg-surface-container/60 transition-colors flex items-center gap-3"
              @click="selectedClose = close"
            >
              <span
                class="material-symbols-outlined text-base"
                :class="close.status === 'complete' ? 'text-secondary' : close.status === 'blocked' ? 'text-error' : 'text-tertiary'"
              >{{ closeStatusIcon(close.status) }}</span>
              <div class="flex-1 min-w-0">
                <p class="font-label-md text-label-md text-on-surface">
                  {{ close.periodType }} · {{ close.periodStart.slice(0,10) }} → {{ close.periodEnd.slice(0,10) }}
                  <span v-if="close.isRerun" class="text-tertiary text-xs ml-1">(re-run)</span>
                </p>
                <p class="font-body-sm text-body-sm text-secondary">
                  {{ formatRelativeTime(close.completedAt ?? close.createdAt) }}
                </p>
              </div>
              <span
                class="px-2 py-0.5 rounded text-xs font-semibold uppercase"
                :class="closeStatusColor(close.status)"
              >{{ close.status }}</span>
            </button>
          </div>
        </div>

      </main>
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h }  from 'vue'
import DashboardLayout   from '@/layouts/DashboardLayout.vue'
import { adminDashboardLinks } from '@/pages/dasboardLinks'
import { formatPence, formatRelativeTime } from '@/utils/format'
import { useFinancialClose }               from '@/composables/useFinancialClose'
import type { ClosePeriodType, CloseStatus } from '@/composables/useFinancialClose'

// ── Inline micro-components ────────────────────────────────────────────────────

const MetricCard = defineComponent({
  props: { label: String, value: String },
  setup(props) {
    return () => h('div', {
      class: 'p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-1 rounded-md',
    }, [
      h('span', { class: 'font-label-md text-label-md text-secondary' }, props.label),
      h('span', { class: 'font-h2 text-h2 text-primary' }, props.value ?? '—'),
    ])
  },
})

const CashRow = defineComponent({
  props: { label: String, value: String, bold: Boolean, error: Boolean },
  setup(props) {
    return () => h('div', { class: 'flex items-center justify-between px-padding-card py-2' }, [
      h('span', { class: 'font-body-sm text-body-sm text-secondary' }, props.label),
      h('span', {
        class: [
          'font-label-md text-label-md',
          props.bold  ? 'font-semibold text-on-surface' : '',
          props.error ? 'text-error font-semibold' : 'text-on-surface',
        ],
      }, props.value ?? '—'),
    ])
  },
})

// ── Composable ─────────────────────────────────────────────────────────────────

const {
  history,
  running,
  runError,
  loadingHistory,
  selectedClose,
  fetchHistory,
  runClose,
  downloadCSV,
  downloadJSON,
  downloadDiscrepanciesCSV,
  printPDF,
} = useFinancialClose()

// ── Period selection ───────────────────────────────────────────────────────────

const periodTypes = [
  { value: 'daily',   label: 'Daily',   icon: 'today' },
  { value: 'weekly',  label: 'Weekly',  icon: 'date_range' },
  { value: 'monthly', label: 'Monthly', icon: 'calendar_month' },
  { value: 'manual',  label: 'Manual',  icon: 'tune' },
] as const

const selectedPeriodType = ref<ClosePeriodType>('daily')
const selectedDate  = ref(new Date().toISOString().slice(0, 10))
const manualStart   = ref(new Date().toISOString().slice(0, 10))
const manualEnd     = ref(new Date().toISOString().slice(0, 10))

const canRun = computed(() => {
  if (selectedPeriodType.value === 'manual') {
    return manualStart.value && manualEnd.value && manualEnd.value > manualStart.value
  }
  return true
})

async function handleRun(): Promise<void> {
  if (selectedPeriodType.value === 'manual') {
    const start = new Date(manualStart.value + 'T00:00:00Z')
    const end   = new Date(manualEnd.value   + 'T00:00:00Z')
    await runClose('manual', { start, end })
  } else if (selectedPeriodType.value === 'monthly') {
    await runClose('monthly')
  } else {
    const date = new Date(selectedDate.value + 'T00:00:00Z')
    await runClose(selectedPeriodType.value, date)
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────

function closeStatusColor(status: CloseStatus): string {
  const map: Record<CloseStatus, string> = {
    open:     'bg-surface-container text-secondary',
    running:  'bg-primary-container text-on-primary-container',
    complete: 'bg-secondary-container text-on-secondary-container',
    blocked:  'bg-error-container text-on-error-container',
    failed:   'bg-error-container text-on-error-container',
  }
  return map[status] ?? 'bg-surface-container text-secondary'
}

function closeStatusIcon(status: CloseStatus): string {
  const map: Record<CloseStatus, string> = {
    open:     'radio_button_unchecked',
    running:  'sync',
    complete: 'check_circle',
    blocked:  'block',
    failed:   'error',
  }
  return map[status] ?? 'circle'
}

onMounted(fetchHistory)
</script>
