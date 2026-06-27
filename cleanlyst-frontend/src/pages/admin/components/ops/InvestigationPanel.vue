<template>
  <div class="flex flex-col gap-6">

    <!-- Derived Payment State -->
    <div class="p-padding-card border border-outline-variant bg-surface-container-lowest rounded-md">
      <p class="font-label-md text-label-md text-secondary mb-1">Derived Payment State</p>
      <span
        class="px-3 py-1 rounded text-sm font-semibold uppercase tracking-wide"
        :class="stateColor"
      >{{ derivedPaymentState }}</span>
    </div>

    <!-- Integrity Report -->
    <div>
      <p class="font-label-md text-label-md text-secondary mb-2">Financial Integrity</p>
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold mb-2"
        :class="integrity.passed && !integrity.warnings.length
          ? 'bg-secondary-container text-on-secondary-container'
          : integrity.violations.length
            ? 'bg-error-container text-on-error-container'
            : 'bg-primary-container text-on-primary-container'"
      >
        <span class="material-symbols-outlined text-base">
          {{ integrity.passed && !integrity.violations.length ? 'check_circle' : 'warning' }}
        </span>
        {{ integrity.passed ? 'Passed' : 'Failed' }}
        · {{ integrity.eventCount }} ledger event{{ integrity.eventCount !== 1 ? 's' : '' }}
      </div>
      <ul v-if="integrity.violations.length" class="flex flex-col gap-1 mb-2">
        <li
          v-for="v in integrity.violations"
          :key="v"
          class="flex items-start gap-2 text-sm text-on-error-container bg-error-container px-3 py-1.5 rounded"
        >
          <span class="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
          {{ v }}
        </li>
      </ul>
      <ul v-if="integrity.warnings.length" class="flex flex-col gap-1">
        <li
          v-for="w in integrity.warnings"
          :key="w"
          class="flex items-start gap-2 text-sm text-on-primary-container bg-primary-container px-3 py-1.5 rounded"
        >
          <span class="material-symbols-outlined text-base shrink-0 mt-0.5">info</span>
          {{ w }}
        </li>
      </ul>
    </div>

    <!-- Reconciliation -->
    <div>
      <p class="font-label-md text-label-md text-secondary mb-2">Ledger Reconciliation</p>
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold mb-2"
        :class="reconciliation.hasMismatch
          ? 'bg-error-container text-on-error-container'
          : 'bg-secondary-container text-on-secondary-container'"
      >
        <span class="material-symbols-outlined text-base">
          {{ reconciliation.hasMismatch ? 'sync_problem' : 'sync' }}
        </span>
        {{ reconciliation.hasMismatch ? 'Mismatch detected' : 'In sync' }}
        · ledger: {{ reconciliation.ledgerState }}
        · cached: {{ reconciliation.cachedPaymentStatus ?? '—' }}
      </div>
      <ul v-if="reconciliation.mismatches.length" class="flex flex-col gap-1">
        <li
          v-for="m in reconciliation.mismatches"
          :key="m"
          class="text-sm text-on-error-container bg-error-container px-3 py-1.5 rounded"
        >{{ m }}</li>
      </ul>
    </div>

    <!-- Anomalies -->
    <div v-if="anomalies.length">
      <p class="font-label-md text-label-md text-secondary mb-2">Anomalies</p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="a in anomalies"
          :key="a.anomalyType + a.detectedAt"
          class="flex items-start gap-2 px-3 py-2 rounded-md border"
          :class="severityStyle(a.severity)"
        >
          <span class="material-symbols-outlined text-base shrink-0 mt-0.5">{{ severityIcon(a.severity) }}</span>
          <div>
            <p class="font-label-sm text-label-sm font-semibold">{{ a.anomalyType.replace(/_/g, ' ') }}</p>
            <p class="font-body-sm text-body-sm">{{ a.description }}</p>
          </div>
          <span class="ml-auto text-xs opacity-70 shrink-0">{{ a.severity }}</span>
        </li>
      </ul>
    </div>
    <div v-else class="text-secondary font-body-sm text-body-sm">
      No anomalies detected.
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FinancialIntegrityReport } from '@/services/payments/financialIntegrityScanner'
import type { ReconciliationReport }      from '@/services/payments/ledgerReconciliationService'
import type { AnomalyReport, AnomalySeverity } from '@/services/payments/paymentAnomalyDetector'
import type { DerivedPaymentState }        from '@/services/payments/paymentLedgerResolver'

const props = defineProps<{
  derivedPaymentState: DerivedPaymentState
  integrity:           FinancialIntegrityReport
  reconciliation:      ReconciliationReport
  anomalies:           AnomalyReport[]
}>()

const stateColor = computed(() => {
  const map: Record<DerivedPaymentState, string> = {
    unpaid:     'bg-surface-container text-secondary',
    authorized: 'bg-primary-container text-on-primary-container',
    captured:   'bg-secondary-container text-on-secondary-container',
    refunded:   'bg-error-container text-on-error-container',
  }
  return map[props.derivedPaymentState] ?? 'bg-surface-container text-secondary'
})

function severityStyle(severity: AnomalySeverity): string {
  const map: Record<AnomalySeverity, string> = {
    low:      'border-outline-variant bg-surface-container',
    medium:   'border-primary/40 bg-primary-container/30',
    high:     'border-error/40 bg-error-container/40',
    critical: 'border-error bg-error-container',
  }
  return map[severity] ?? 'border-outline-variant bg-surface-container'
}

function severityIcon(severity: AnomalySeverity): string {
  const map: Record<AnomalySeverity, string> = {
    low:      'info',
    medium:   'warning',
    high:     'error',
    critical: 'dangerous',
  }
  return map[severity] ?? 'warning'
}
</script>
