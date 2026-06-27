<template>
  <div class="bg-background text-on-background antialiased">
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <!-- Header -->
      <section class="space-y-2 mb-8">
        <h1 class="font-h1 text-h1 text-primary">Financial Audit</h1>
        <p class="font-body text-body text-secondary">
          Reconcile every booking against its stored financial snapshot.
        </p>
      </section>

      <p v-if="error" class="mb-6 text-caption text-red-600">{{ error }}</p>

      <!-- Table -->
      <section class="mb-4">
        <div class="overflow-x-auto border border-outline-variant bg-surface-container-lowest">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant text-secondary">
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Booking</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Service</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Customer</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Cleaner</th>
                <th class="px-4 py-3 font-label-md text-label-md text-right whitespace-nowrap">Service Fee</th>
                <th class="px-4 py-3 font-label-md text-label-md text-right whitespace-nowrap">Booking Fee</th>
                <th class="px-4 py-3 font-label-md text-label-md text-right whitespace-nowrap">Commission</th>
                <th class="px-4 py-3 font-label-md text-label-md text-right whitespace-nowrap">Cleaner Payout</th>
                <th class="px-4 py-3 font-label-md text-label-md text-right whitespace-nowrap">Platform Revenue</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Payment</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Status</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-outline-variant">
              <tr v-if="loading">
                <td colspan="11" class="px-4 py-12 text-center text-caption text-secondary">
                  Loading…
                </td>
              </tr>
              <tr v-else-if="rows.length === 0">
                <td colspan="11" class="px-4 py-12 text-center text-caption text-secondary">
                  No audit records found.
                </td>
              </tr>
              <tr
                v-else
                v-for="row in rows"
                :key="row.bookingId"
                :class="[
                  'transition-colors',
                  row.valid ? 'hover:bg-surface-container-low' : 'bg-red-50 hover:bg-red-100',
                ]"
              >
                <td class="px-4 py-3 font-mono text-xs text-secondary whitespace-nowrap">
                  {{ shortId(row.bookingId) }}
                  <span v-if="!row.valid" class="ml-1 text-red-600" title="Financial mismatch">⚠</span>
                </td>
                <td class="px-4 py-3 text-body text-primary max-w-[160px] truncate">
                  {{ row.serviceTitle ?? '—' }}
                </td>
                <td class="px-4 py-3 text-body text-secondary whitespace-nowrap">
                  {{ row.customerName ?? '—' }}
                </td>
                <td class="px-4 py-3 text-body text-secondary whitespace-nowrap">
                  {{ row.cleanerName ?? '—' }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-primary whitespace-nowrap">
                  {{ formatPence(row.serviceFeeCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-secondary whitespace-nowrap">
                  {{ formatPence(row.bookingFeeCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-secondary whitespace-nowrap">
                  {{ formatPence(row.commissionCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-primary whitespace-nowrap">
                  {{ formatPence(row.cleanerPayoutCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-primary whitespace-nowrap">
                  {{ formatPence(row.platformRevenueCents) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    :class="[
                      'font-caption text-caption',
                      row.paymentStatus === 'released'
                        ? 'text-green-700'
                        : row.paymentStatus === 'refunded' || row.paymentStatus === 'failed'
                          ? 'text-red-600'
                          : 'text-secondary',
                    ]"
                  >
                    {{ row.paymentStatus ?? '—' }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="font-caption text-caption text-secondary">
                    {{ row.bookingStatus }}
                  </span>
                </td>
              </tr>

              <!-- Totals row -->
              <tr
                v-if="!loading && rows.length > 0"
                class="bg-surface-container font-label-md border-t-2 border-outline-variant"
              >
                <td colspan="4" class="px-4 py-3 text-secondary font-label-md text-label-md">
                  Totals ({{ rows.length }} bookings)
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-primary whitespace-nowrap">
                  {{ formatPence(totals.serviceFeeCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-secondary whitespace-nowrap">
                  {{ formatPence(totals.bookingFeeCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-secondary whitespace-nowrap">
                  {{ formatPence(totals.commissionCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-primary whitespace-nowrap">
                  {{ formatPence(totals.cleanerPayoutCents) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-primary whitespace-nowrap">
                  {{ formatPence(totals.platformRevenueCents) }}
                </td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="!loading && rows.length > 0" class="flex justify-between items-center mt-4">
          <span class="font-caption text-caption text-secondary">
            Showing {{ offset + 1 }}–{{ offset + rows.length }}
          </span>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="offset === 0"
              class="btn-secondary text-sm disabled:opacity-40"
              @click="prevPage"
            >
              Previous
            </button>
            <button
              type="button"
              :disabled="rows.length < PAGE_SIZE"
              class="btn-secondary text-sm disabled:opacity-40"
              @click="nextPage"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getFinancialAudit, type AuditRow, formatPence } from '@/services/financialService'
import { validateFinancials } from '@/modules/pricing/financialValidator'
import { toUserMessage } from '@/utils/format'

const PAGE_SIZE = 50

interface AuditRowExtended extends AuditRow {
  valid: boolean
}

const rows = ref<AuditRowExtended[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const offset = ref(0)

const totals = computed(() => ({
  serviceFeeCents: rows.value.reduce((s, r) => s + r.serviceFeeCents, 0),
  bookingFeeCents: rows.value.reduce((s, r) => s + r.bookingFeeCents, 0),
  commissionCents: rows.value.reduce((s, r) => s + r.commissionCents, 0),
  cleanerPayoutCents: rows.value.reduce((s, r) => s + r.cleanerPayoutCents, 0),
  platformRevenueCents: rows.value.reduce((s, r) => s + r.platformRevenueCents, 0),
}))

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await getFinancialAudit(PAGE_SIZE, offset.value)
    rows.value = data.map((r) => ({
      ...r,
      valid: validateFinancials({
        serviceAmountCents: r.serviceFeeCents,
        bookingFeeCents: r.bookingFeeCents,
        commissionCents: r.commissionCents,
        customerTotalCents: r.quoteCents,
        cleanerPayoutCents: r.cleanerPayoutCents,
        platformRevenueCents: r.platformRevenueCents,
      }).valid,
    }))
  } catch (e) {
    error.value = toUserMessage(e, 'Failed to load audit data. Please refresh.')
  } finally {
    loading.value = false
  }
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

function prevPage() {
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  load()
}

function nextPage() {
  offset.value += PAGE_SIZE
  load()
}

onMounted(load)
</script>
