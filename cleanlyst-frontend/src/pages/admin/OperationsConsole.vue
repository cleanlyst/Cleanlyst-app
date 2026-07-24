<template>
  <DashboardLayout :links="adminDashboardLinks">
    <div class="bg-background text-on-background antialiased">
      <main class="flex-grow p-6 lg:p-10 overflow-x-hidden max-w-7xl mx-auto">

        <!-- Header + Search -->
        <div class="mb-6">
          <h1 class="font-h2 text-h2 text-on-surface mb-1">Operations Console</h1>
          <p class="font-body-md text-body-md text-secondary mb-4">
            Search any booking, customer, cleaner, or Stripe ID
          </p>

          <!-- Search bar -->
          <div class="relative max-w-2xl">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
              search
            </span>
            <input
              v-model="query"
              type="text"
              placeholder="Booking UUID · email · pi_ · cs_ · tr_"
              class="w-full pl-10 pr-4 py-3 border border-outline bg-surface rounded-md font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Search bookings, customers, or Stripe IDs"
              autocomplete="off"
              @input="onInput"
              @keydown.enter="search(query)"
              @keydown.escape="searchResults = []"
            />
            <button
              v-if="query"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface"
              type="button"
              aria-label="Clear search"
              @click="query = ''; searchResults = []"
            >
              <span class="material-symbols-outlined text-base" aria-hidden="true">close</span>
            </button>
          </div>

          <!-- Search spinner / error -->
          <p v-if="searching" class="text-secondary font-body-sm text-body-sm mt-2 animate-pulse">Searching…</p>
          <p v-if="searchError" class="text-error font-body-sm text-body-sm mt-2">{{ searchError }}</p>

          <!-- Search results dropdown -->
          <div
            v-if="searchResults.length"
            class="mt-1 border border-outline-variant bg-surface rounded-md shadow-md max-w-2xl overflow-hidden z-10"
          >
            <button
              v-for="result in searchResults"
              :key="result.bookingId"
              class="w-full text-left px-4 py-3 hover:bg-surface-container transition-colors border-b border-outline-variant/50 last:border-0"
              @click="select(result.bookingId)"
            >
              <p class="font-mono text-sm text-on-surface">{{ result.bookingId }}</p>
              <p class="font-body-sm text-body-sm text-secondary mt-0.5">{{ result.hint }}</p>
            </button>
          </div>
          <p v-else-if="!searching && query.trim() && !searchResults.length && hasSearched" class="text-secondary font-body-sm text-body-sm mt-2">
            No results found.
          </p>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-3">
          <div class="h-24 bg-surface-container rounded-md animate-pulse"></div>
          <div class="h-48 bg-surface-container rounded-md animate-pulse"></div>
        </div>

        <!-- Error state -->
        <div v-else-if="loadError" class="p-4 bg-error-container text-on-error-container rounded-md flex items-center gap-2">
          <span class="material-symbols-outlined">error</span>
          {{ loadError }}
        </div>

        <!-- Empty — no selection -->
        <div v-else-if="!bundle" class="flex flex-col items-center justify-center py-20 text-secondary gap-2">
          <span class="material-symbols-outlined text-5xl">manage_search</span>
          <p class="font-body-lg text-body-lg">Search for a booking to begin investigation</p>
        </div>

        <!-- Bundle loaded -->
        <template v-else>
          <!-- Booking summary + live indicator -->
          <div class="mb-4 flex items-center justify-between gap-4">
            <div class="flex items-center gap-2 text-xs text-tertiary">
              <span class="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              Live
              <span v-if="refreshedAt">· Updated {{ formatRelativeTime(refreshedAt.toISOString()) }}</span>
            </div>
            <button
              class="flex items-center gap-1 text-secondary font-label-sm text-label-sm hover:text-primary transition-colors"
              @click="clear"
            >
              <span class="material-symbols-outlined text-base">close</span>
              Close
            </button>
          </div>

          <BookingSummaryCard
            :booking="bundle.booking"
            :stripe-ids="bundle.stripeIds"
            class="mb-6"
            @refresh="refresh"
          />

          <!-- Sections in accordion/tab layout -->
          <div class="flex flex-col gap-6">

            <!-- Financial summary -->
            <OpsSection title="Financial Summary" icon="account_balance_wallet">
              <FinancialSummary :payment="bundle.payment" :payout="bundle.payout" />
            </OpsSection>

            <!-- Merged timeline -->
            <OpsSection title="Event Timeline" icon="timeline">
              <PaymentTimeline :entries="bundle.timeline" />
            </OpsSection>

            <!-- Ledger events -->
            <OpsSection title="Ledger Events" icon="receipt_long">
              <LedgerTimeline :events="bundle.ledgerEvents" />
            </OpsSection>

            <!-- Investigation panel -->
            <OpsSection title="Investigation" icon="fact_check">
              <InvestigationPanel
                :derived-payment-state="bundle.derivedPaymentState"
                :integrity="bundle.integrity"
                :reconciliation="bundle.reconciliation"
                :anomalies="bundle.anomalies"
              />
            </OpsSection>

            <!-- Support history (notifications) -->
            <OpsSection title="Notifications" icon="notifications" lazy>
              <SupportHistory :booking-id="bundle.bookingId" />
            </OpsSection>

            <!-- Webhook history -->
            <OpsSection title="Webhook Events" icon="webhook" lazy>
              <WebhookHistory :booking-id="bundle.bookingId" />
            </OpsSection>

            <!-- Actions -->
            <OpsSection title="Actions" icon="bolt">
              <BookingActions
                :booking-id="bundle.bookingId"
                :booking-status="bundle.booking.status"
                :payment-status="bundle.booking.paymentStatus"
                :has-stripe-payment="!!bundle.payment.stripePaymentIntentId"
                :payment-amount-cents="bundle.payment.amountCents"
                @refresh="refresh"
              />
            </OpsSection>

          </div>
        </template>

      </main>
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent, onMounted } from 'vue'
import { useRoute }                              from 'vue-router'
import { formatRelativeTime }                    from '@/utils/format'
import DashboardLayout                           from '@/layouts/DashboardLayout.vue'
import { adminDashboardLinks }                   from '@/pages/dasboardLinks'
import { useOperationsConsole }                  from '@/composables/useOperationsConsole'

// Eager — always visible
import BookingSummaryCard  from './components/ops/BookingSummaryCard.vue'
import FinancialSummary    from './components/ops/FinancialSummary.vue'
import PaymentTimeline     from './components/ops/PaymentTimeline.vue'
import LedgerTimeline      from './components/ops/LedgerTimeline.vue'
import InvestigationPanel  from './components/ops/InvestigationPanel.vue'
import BookingActions      from './components/ops/BookingActions.vue'

// Lazy — loaded on demand
const SupportHistory  = defineAsyncComponent(() => import('./components/ops/SupportHistory.vue'))
const WebhookHistory  = defineAsyncComponent(() => import('./components/ops/WebhookHistory.vue'))

// ── Inline section wrapper ─────────────────────────────────────────────────────
// OpsSection is simple enough to define inline rather than as a separate file
import { defineComponent, h, ref as vref } from 'vue'
const OpsSection = defineComponent({
  name: 'OpsSection',
  props: {
    title: { type: String, required: true },
    icon:  { type: String, required: true },
    lazy:  { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const open = vref(!props.lazy)
    return () => h(
      'div',
      { class: 'border border-outline-variant bg-surface-container-lowest rounded-md overflow-hidden' },
      [
        h(
          'button',
          {
            class: 'w-full flex items-center gap-2 px-padding-card py-3 text-left hover:bg-surface-container/60 transition-colors',
            onClick: () => { open.value = !open.value },
          },
          [
            h('span', { class: 'material-symbols-outlined text-secondary text-base' }, props.icon),
            h('span', { class: 'font-label-lg text-label-lg text-on-surface flex-1' }, props.title),
            h('span', { class: 'material-symbols-outlined text-secondary text-base transition-transform', style: open.value ? 'transform:rotate(180deg)' : '' }, 'expand_more'),
          ],
        ),
        open.value
          ? h('div', { class: 'px-padding-card pb-padding-card pt-2' }, slots.default?.())
          : null,
      ],
    )
  },
})

// ── Composable ─────────────────────────────────────────────────────────────────

const {
  query,
  searching,
  searchError,
  searchResults,
  search,
  bundle,
  loading,
  loadError,
  refreshedAt,
  select,
  clear,
  refresh,
} = useOperationsConsole()

const hasSearched = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onInput(): void {
  hasSearched.value = false
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    if (query.value.trim().length >= 3) {
      await search(query.value)
      hasSearched.value = true
    }
  }, 350)
}

// ── Deep-link support (/admin/ops/:bookingId) ─────────────────────────────────

const route = useRoute()
onMounted(() => {
  const id = route.params.bookingId as string | undefined
  if (id) select(id)
})
</script>
