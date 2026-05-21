<template>
  <div class="bg-background text-on-background antialiased">
    <main class="pt-8 pb-24 px-6 lg:px-12 max-w-4xl">
      <section class="space-y-2 mb-10">
        <h1 class="font-h1 text-h1 text-primary">Platform Fees</h1>
        <p class="font-body text-body text-secondary">
          Set the fees applied to every booking. Changes take effect on new bookings only — existing bookings retain their original snapshot.
        </p>
      </section>

      <div v-if="loadError" class="mb-6 p-4 border border-red-200 bg-red-50 text-red-700 text-sm">
        {{ loadError }}
      </div>

      <div v-if="migrationPending" class="mb-6 p-4 border border-amber-300 bg-amber-50 text-amber-800 text-sm space-y-2">
        <p class="font-semibold">Database migration required</p>
        <p>The <code class="bg-amber-100 px-1">cleaner_commission_percent</code> column is missing. Commission settings will not be saved until you apply the migration.</p>
        <p>Go to <strong>Supabase Dashboard → SQL Editor</strong> and run the file:<br>
          <code class="bg-amber-100 px-1">supabase/migrations/20260521100000_platform_fees_apply.sql</code>
        </p>
        <p>Booking fee can still be saved in the meantime.</p>
      </div>

      <div class="bg-surface-container-lowest border border-outline-variant p-padding-card space-y-8">
        <div class="flex items-center gap-3 pb-6 border-b border-outline-variant">
          <span class="material-symbols-outlined text-primary text-2xl">account_balance_wallet</span>
          <h2 class="font-h2 text-h2 text-primary">Fee Settings</h2>
        </div>

        <div v-if="loading" class="py-8 text-center text-secondary text-sm animate-pulse">
          Loading current settings…
        </div>

        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Customer booking fee -->
            <div class="space-y-2">
              <label class="block font-label-md text-label-md text-primary" for="booking-fee">
                Customer Booking Fee (%)
              </label>
              <p class="text-caption font-caption text-secondary">
                Added on top of the service price. Customer pays: service + this fee.
              </p>
              <div class="relative">
                <input
                  id="booking-fee"
                  v-model.number="bookingFeeInput"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  class="w-full h-12 border border-outline-variant bg-white px-4 pr-10 font-body text-body focus:border-primary focus:ring-0 outline-none"
                  :disabled="saving"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary font-label-md">%</span>
              </div>
              <p class="text-caption font-caption text-secondary">
                Example: on £100 service, customer pays £{{ exampleCustomerTotal }}.
              </p>
            </div>

            <!-- Cleaner commission -->
            <div class="space-y-2">
              <label class="block font-label-md text-label-md text-primary" for="commission">
                Cleaner Commission (%)
              </label>
              <p class="text-caption font-caption text-secondary">
                Deducted from service price. Cleaner receives: service − this fee.
              </p>
              <div class="relative">
                <input
                  id="commission"
                  v-model.number="commissionInput"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  class="w-full h-12 border border-outline-variant bg-white px-4 pr-10 font-body text-body focus:border-primary focus:ring-0 outline-none"
                  :disabled="saving"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary font-label-md">%</span>
              </div>
              <p class="text-caption font-caption text-secondary">
                Example: on £100 service, cleaner receives £{{ exampleCleanerPayout }}.
              </p>
            </div>
          </div>

          <!-- Live preview -->
          <div class="border border-outline-variant bg-surface-container p-5 space-y-3">
            <p class="font-label-md text-label-md text-primary uppercase tracking-widest text-xs">
              Live preview — £100 service
            </p>
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Customer pays</span>
              <span class="font-medium text-primary">£{{ exampleCustomerTotal }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Platform revenue (booking fee + commission)</span>
              <span class="font-medium text-primary">£{{ examplePlatformRevenue }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Cleaner receives</span>
              <span class="font-medium text-primary">£{{ exampleCleanerPayout }}</span>
            </div>
          </div>

          <div v-if="saveError" class="p-4 border border-red-200 bg-red-50 text-red-700 text-sm">
            {{ saveError }}
          </div>
          <div v-if="saveSuccess" class="p-4 border border-green-200 bg-green-50 text-green-700 text-sm">
            Settings saved successfully. New bookings will use these rates.
          </div>

          <div class="flex items-center gap-4 pt-4 border-t border-outline-variant">
            <button
              class="px-8 py-3 bg-primary text-white font-label-md disabled:opacity-50 flex items-center gap-2"
              :disabled="saving || !isDirty"
              @click="save"
            >
              <span v-if="saving" class="loading-spinner-sm"></span>
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </button>
            <button
              v-if="isDirty"
              type="button"
              class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
              :disabled="saving"
              @click="reset"
            >
              Discard
            </button>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { invalidatePlatformSettingsCache } from '@/services/pricingEngine'

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveSuccess = ref(false)
const migrationPending = ref(false)

const savedBookingFee = ref(7)
const savedCommission = ref(15)
const bookingFeeInput = ref(7)
const commissionInput = ref(15)
let settingsRowId = ''

const isDirty = computed(
  () =>
    bookingFeeInput.value !== savedBookingFee.value ||
    commissionInput.value !== savedCommission.value,
)

const exampleCustomerTotal = computed(() =>
  (100 + 100 * (bookingFeeInput.value / 100)).toFixed(2),
)
const exampleCleanerPayout = computed(() =>
  (100 - 100 * (commissionInput.value / 100)).toFixed(2),
)
const examplePlatformRevenue = computed(() =>
  (
    100 * (bookingFeeInput.value / 100) +
    100 * (commissionInput.value / 100)
  ).toFixed(2),
)

onMounted(loadSettings)

async function loadSettings() {
  loading.value = true
  loadError.value = ''
  migrationPending.value = false
  try {
    const supabase = requireSupabase()
    // Use select('*') so PostgREST never fails on a missing column —
    // if cleaner_commission_percent doesn't exist yet we fall back to the default.
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      // surface the real Supabase message so it's actionable
      throw new Error(error.message ?? error.code ?? 'Unknown Supabase error')
    }

    const row = data as Record<string, unknown>
    settingsRowId = String(row.id ?? '')

    savedBookingFee.value = Number(row.booking_fee_percent ?? 7)
    bookingFeeInput.value = savedBookingFee.value

    if ('cleaner_commission_percent' in row && row.cleaner_commission_percent != null) {
      savedCommission.value = Number(row.cleaner_commission_percent)
    } else {
      // Column doesn't exist yet — migration needs to be applied
      migrationPending.value = true
      savedCommission.value = 15
    }
    commissionInput.value = savedCommission.value
  } catch (e) {
    loadError.value =
      e instanceof Error
        ? `Failed to load settings: ${e.message}`
        : 'Failed to load platform settings.'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!isDirty.value || saving.value) return
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    const supabase = requireSupabase()

    // Build update payload — only include commission if the column exists
    const payload: Record<string, unknown> = {
      booking_fee_percent: bookingFeeInput.value,
    }
    if (!migrationPending.value) {
      payload.cleaner_commission_percent = commissionInput.value
    }

    const { error } = await supabase
      .from('platform_settings')
      .update(payload)
      .eq('id', settingsRowId)

    if (error) {
      throw new Error(error.message ?? error.code ?? 'Unknown Supabase error')
    }

    savedBookingFee.value = bookingFeeInput.value
    if (!migrationPending.value) savedCommission.value = commissionInput.value
    invalidatePlatformSettingsCache()
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 4000)
  } catch (e) {
    saveError.value =
      e instanceof Error
        ? `Failed to save: ${e.message}`
        : 'Failed to save settings.'
  } finally {
    saving.value = false
  }
}

function reset() {
  bookingFeeInput.value = savedBookingFee.value
  commissionInput.value = savedCommission.value
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.loading-spinner-sm {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
