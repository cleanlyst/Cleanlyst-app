<template>
  <main class="pt-24 pb-24 px-6 max-w-7xl mx-auto">

    <!-- Wizard -->

      <!-- Header + Progress -->
      <section class="mb-10 max-w-3xl mx-auto">
        <h1 class="font-h1 text-h1 text-primary mb-1">Book Cleaner</h1>
        <div class="flex items-center gap-2 mt-4" role="list" aria-label="Booking progress">
          <template v-for="(label, i) in STEP_LABELS" :key="i">
            <div
              role="listitem"
              :aria-current="step === i + 1 ? 'step' : undefined"
              :class="[
                'flex items-center gap-1.5 text-xs font-medium',
                step === i + 1 ? 'text-primary' : step > i + 1 ? 'text-green-700' : 'text-on-surface-variant',
              ]"
            >
              <span
                :class="[
                  'w-5 h-5 flex items-center justify-center text-[10px] font-bold',
                  step === i + 1
                    ? 'bg-primary text-white'
                    : step > i + 1
                      ? 'bg-green-600 text-white'
                      : 'bg-surface-variant text-on-surface-variant',
                ]"
              >
                <span v-if="step > i + 1" class="material-symbols-outlined text-[12px]">check</span>
                <span v-else>{{ i + 1 }}</span>
              </span>
              <span class="hidden sm:inline">{{ label }}</span>
            </div>
            <div v-if="i < STEP_LABELS.length - 1" class="flex-1 h-px bg-outline-variant max-w-8"></div>
          </template>
        </div>
      </section>

      <!-- Step 1: Service -->
      <section v-if="step === 1" class="max-w-2xl mx-auto space-y-8">
        <h2 class="font-h2 text-h2 text-primary">Choose the service you need</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            v-for="svc in CORE_SERVICE_CATEGORY.subServices"
            :key="svc.slug"
            type="button"
            :class="[
              'text-left p-5 border transition-colors space-y-2',
              selectedServiceSlug === svc.slug
                ? 'border-primary bg-surface-variant'
                : 'border-outline-variant bg-white hover:border-primary',
            ]"
            @click="selectedServiceSlug = svc.slug"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="material-symbols-outlined text-2xl text-primary">{{
                svc.icon ?? 'cleaning_services'
              }}</span>
              <span
                v-if="selectedServiceSlug === svc.slug"
                class="material-symbols-outlined text-primary filled-icon"
                >check_circle</span
              >
            </div>
            <p class="font-label-md text-label-md text-primary">{{ svc.name }}</p>
            <p class="text-caption font-caption text-secondary line-clamp-2">{{ svc.description }}</p>
          </button>
        </div>
      </section>

      <!-- Step 2: Schedule -->
      <section v-else-if="step === 2" class="max-w-3xl mx-auto space-y-6">
        <h2 class="font-h2 text-h2 text-primary">Schedule</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="booking-date" class="block font-label-md text-label-md text-primary mb-2">Date</label>
            <input
              id="booking-date"
              v-model="bookingDate"
              type="date"
              :min="minDate"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            />
          </div>
          <div>
            <label for="booking-time" class="block font-label-md text-label-md text-primary mb-2">Start Time</label>
            <input
              id="booking-time"
              v-model="bookingTime"
              type="time"
              :min="minBookingTime"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            />
          </div>
        </div>
      </section>

      <!-- Step 3: Property Details -->
      <section v-else-if="step === 3" class="max-w-3xl mx-auto space-y-6">
        <h2 class="font-h2 text-h2 text-primary">Property Details</h2>
        <div class="space-y-4">
          <div>
            <label for="booking-property-type" class="block font-label-md text-label-md text-primary mb-2">Property Type</label>
            <select
              id="booking-property-type"
              v-model="propertyType"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            >
              <option value="" disabled>Select type</option>
              <option v-for="opt in PROPERTY_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="booking-bedrooms" class="block font-label-md text-label-md text-primary mb-2">Bedrooms</label>
              <select
                id="booking-bedrooms"
                v-model="bedrooms"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
              >
                <option value="" disabled>Select</option>
                <option value="studio">Studio</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10+">10+</option>
              </select>
            </div>
            <div>
              <label for="booking-bathrooms" class="block font-label-md text-label-md text-primary mb-2">Bathrooms</label>
              <select
                id="booking-bathrooms"
                v-model="bathrooms"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
              >
                <option value="" disabled>Select</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10+">10+</option>
              </select>
            </div>
          </div>
          <div>
            <label for="address-line1" class="block font-label-md text-label-md text-primary mb-2">Address</label>
            <input
              id="address-line1"
              v-model="addressLine1"
              type="text"
              placeholder="Address line 1"
              autocomplete="address-line1"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none mb-2"
            />
            <label for="address-line2" class="sr-only">Address line 2</label>
            <input
              id="address-line2"
              v-model="addressLine2"
              type="text"
              placeholder="Address line 2 (optional)"
              autocomplete="address-line2"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none mb-2"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label for="address-city" class="sr-only">City</label>
                <input
                  id="address-city"
                  v-model="addressCity"
                  type="text"
                  placeholder="City"
                  autocomplete="address-level2"
                  class="w-full h-12 px-3 border bg-white font-body focus:ring-0 outline-none"
                  :class="cityOutsideRollout ? 'border-amber-400' : 'border-outline-variant focus:border-primary'"
                />
                <p v-if="cityOutsideRollout" class="text-xs text-amber-600 leading-snug">
                  {{ ROLLOUT_UNAVAILABLE_MESSAGE }}
                </p>
              </div>
              <div class="flex flex-col gap-1">
                <label for="address-postcode" class="sr-only">Postcode</label>
                <input
                  id="address-postcode"
                  v-model="addressPostcode"
                  type="text"
                  placeholder="Postcode"
                  autocomplete="postal-code"
                  class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label class="block font-label-md text-label-md text-primary mb-2"
              >Notes (Optional)</label
            >
            <textarea
              v-model="notes"
              rows="3"
              placeholder="Any specific instructions…"
              class="w-full p-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none resize-none"
            ></textarea>
          </div>
          <!-- Save as preferences -->
          <label v-if="prefsChanged" class="flex items-center gap-3 cursor-pointer">
            <input
              v-model="saveAsPreferences"
              type="checkbox"
              class="w-4 h-4 accent-zinc-900"
            />
            <span class="font-label-md text-label-md text-primary text-sm">Save as my preferences</span>
          </label>
        </div>
      </section>

      <!-- Step 4: Cleaner -->
      <section v-else-if="step === 4" class="max-w-5xl mx-auto space-y-6">
        <h2 class="font-h2 text-h2 text-primary">Available Cleaners</h2>

        <!-- Loading skeleton -->
        <div v-if="loadingCleaners" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="n in 3"
            :key="n"
            class="border border-outline-variant overflow-hidden animate-pulse"
          >
            <div class="aspect-[16/9] bg-surface-container"></div>
            <div class="p-4 space-y-3">
              <div class="h-5 bg-surface-container rounded w-2/3"></div>
              <div class="h-4 bg-surface-container rounded w-1/2"></div>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div
          v-else-if="cleaners.length === 0"
          class="border border-dashed border-outline-variant p-16 text-center"
        >
          <span class="material-symbols-outlined text-5xl text-outline-variant block mb-4"
            >search_off</span
          >
          <p class="font-label-md text-label-md text-on-surface">No cleaners available</p>
          <p class="text-caption text-on-surface-variant mt-1">Try a different date or time.</p>
        </div>

        <!-- Cleaner cards -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="c in cleaners"
            :key="c.user_id"
            type="button"
            class="bg-white border border-outline-variant overflow-hidden group hover:border-primary transition-colors cursor-pointer text-left w-full"
            :aria-label="`Select ${displayName(c)}`"
            @click="selectCleaner(c)"
          >
            <div class="aspect-[16/9] w-full relative overflow-hidden bg-surface-variant">
              <img
                v-if="c.profiles?.avatar_url"
                :src="c.profiles.avatar_url"
                :alt="displayName(c)"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-surface-container"
              >
                <span class="material-symbols-outlined text-5xl text-on-surface-variant">person</span>
              </div>
              <div
                v-if="c.average_rating >= 4.9"
                class="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
              >
                Top Rated
              </div>
            </div>
            <div class="p-4 space-y-3">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-h2 text-h2 text-primary">{{ displayName(c) }}</h3>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-[16px] star-filled">star</span>
                    <span class="font-label-md text-label-md">{{ c.average_rating.toFixed(1) }}</span>
                    <span class="text-secondary font-caption text-caption"
                      >({{ c.review_count }})</span
                    >
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-h2 text-h2">
                    {{ estimatedCostForCleaner(c) > 0 ? formatPence(estimatedCostForCleaner(c)) : '—' }}
                  </div>
                  <div class="text-secondary text-caption font-caption">service price</div>
                </div>
              </div>
              <p v-if="c.bio" class="text-sm text-on-surface-variant line-clamp-2">{{ c.bio }}</p>
              <div class="pt-3 border-t border-outline-variant">
                <div class="flex items-center gap-2 mb-3">
                  <span class="material-symbols-outlined text-secondary text-sm">verified</span>
                  <span class="font-caption text-caption text-secondary">Verified cleaner</span>
                </div>
                <span
                  class="block w-full py-2.5 bg-primary text-on-primary font-label-md text-sm text-center"
                  aria-hidden="true"
                >
                  Select
                </span>
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- Step 5: Payment -->
      <section v-else-if="step === 5" class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div class="lg:col-span-7 space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Payment</h2>

          <!-- Selected cleaner -->
          <div class="border border-outline-variant p-5 flex items-center gap-4">
            <div
              class="h-14 w-14 rounded-full overflow-hidden bg-surface-container border border-outline-variant flex items-center justify-center flex-shrink-0"
            >
              <img
                v-if="selectedCleaner?.profiles?.avatar_url"
                :src="selectedCleaner.profiles.avatar_url"
                :alt="displayName(selectedCleaner!)"
                class="w-full h-full object-cover"
              />
              <span v-else class="material-symbols-outlined text-on-surface-variant text-2xl"
                >person</span
              >
            </div>
            <div>
              <p class="font-label-md text-label-md text-primary">{{ displayName(selectedCleaner!) }}</p>
              <div class="flex items-center gap-1 mt-0.5">
                <span class="material-symbols-outlined text-[14px] star-filled">star</span>
                <span class="text-caption font-caption text-secondary">
                  {{ selectedCleaner!.average_rating.toFixed(1) }} ({{
                    selectedCleaner!.review_count
                  }}
                  reviews)
                </span>
              </div>
            </div>
          </div>

          <!-- Booking details -->
          <div class="border border-outline-variant p-5 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Service</span>
              <span class="text-primary font-medium">{{ selectedServiceLabel }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Date</span>
              <span class="text-primary font-medium">{{ formatDateDisplay(bookingDate) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Time</span>
              <span class="text-primary font-medium">{{ bookingTime }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-secondary">Property</span>
              <span class="text-primary font-medium">{{ propertyLabel }}</span>
            </div>
            <div v-if="locationText" class="flex justify-between text-sm">
              <span class="text-secondary">Address</span>
              <span class="text-primary font-medium text-right max-w-[60%]">{{ locationText }}</span>
            </div>
          </div>

          <!-- Payment method selection (shown when cleaner accepts multiple methods) -->
          <div
            v-if="availablePaymentMethods.length > 1"
            class="border border-outline-variant p-5 space-y-3"
          >
            <h3 class="font-label-md text-label-md text-primary">How would you like to pay?</h3>
            <div class="space-y-2">
              <label
                v-for="method in availablePaymentMethods"
                :key="method.value"
                :class="[
                  'flex items-center gap-3 p-3 border cursor-pointer transition-colors',
                  selectedPaymentMethod === method.value
                    ? 'border-primary bg-surface-variant'
                    : 'border-outline-variant hover:border-primary',
                ]"
              >
                <input
                  v-model="selectedPaymentMethod"
                  :value="method.value"
                  type="radio"
                  class="w-4 h-4 accent-primary flex-shrink-0"
                />
                <span class="material-symbols-outlined text-xl text-primary">{{ method.icon }}</span>
                <div>
                  <p class="font-label-md text-label-md text-primary text-sm">{{ method.label }}</p>
                  <p class="text-caption text-secondary text-xs">{{ method.description }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Pricing breakdown (card payments show full breakdown; offline shows service total only) -->
          <div class="border border-outline-variant p-5 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-secondary">{{ selectedServiceLabel }}</span>
              <span class="text-primary font-medium">{{ formatPence(basePricePence) }}</span>
            </div>
            <template v-if="selectedPaymentMethod === 'card'">
              <div class="pt-3 border-t border-outline-variant space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-secondary">Subtotal</span>
                  <span class="text-primary">{{ formatPence(subtotalPence) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-secondary">{{ bookingFeeLabel }}</span>
                  <span class="text-primary">{{ formatPence(bookingFeePence) }}</span>
                </div>
                <p class="text-caption font-caption text-secondary text-xs mt-2">
                  * Platform fee covers secure payments, customer support, and cleaner vetting.
                </p>
                <div class="flex justify-between pt-2 border-t border-outline-variant">
                  <span class="font-h2 text-h2 text-primary">Total</span>
                  <span class="font-h2 text-h2 text-primary">{{ formatPence(totalPence) }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="pt-3 border-t border-outline-variant">
                <div class="flex justify-between">
                  <span class="font-h2 text-h2 text-primary">Total to pay cleaner</span>
                  <span class="font-h2 text-h2 text-primary">{{ formatPence(basePricePence) }}</span>
                </div>
                <p class="text-caption text-secondary text-xs mt-2">
                  No platform payment required.
                  {{ selectedPaymentMethod === 'cash' ? 'Pay your cleaner in cash on the day.' : 'Transfer directly to your cleaner before the clean.' }}
                </p>
              </div>
            </template>
          </div>

          <p v-if="payError" class="text-caption text-red-600">{{ payError }}</p>

          <button
            class="w-full py-4 bg-primary text-white font-label-md disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="paying || loadingServices"
            data-testid="confirm-pay-btn"
            @click="confirmAndPay"
          >
            <span v-if="paying || loadingServices" class="loading-spinner-sm"></span>
            <template v-if="paying || loadingServices">
              {{ paying ? 'Processing…' : 'Loading…' }}
            </template>
            <template v-else>
              {{ selectedPaymentMethod === 'card' ? 'Confirm and Pay' : 'Confirm Booking' }}
            </template>
          </button>
          <p class="text-center text-caption font-caption text-secondary">
            <template v-if="selectedPaymentMethod === 'card'">
              Payment held securely. Released to cleaner after job completion.
            </template>
            <template v-else>
              Your booking will be confirmed once the cleaner accepts.
            </template>
          </p>
        </div>

        <aside class="lg:col-span-5">
          <div
            class="sticky top-24 bg-surface-container-low border border-outline-variant p-5 flex items-start gap-3"
          >
            <span class="material-symbols-outlined text-primary mt-0.5">shield</span>
            <div>
              <p class="font-label-md text-label-md text-primary text-sm">Cleanlyst Guarantee</p>
              <p class="text-caption font-caption text-secondary text-xs mt-1">
                Your payment is held securely and only released after the job is completed.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <!-- Navigation buttons -->
      <div v-if="step >= 1 && step <= 3" class="flex items-center justify-between pt-8 max-w-3xl mx-auto">
        <button
          v-if="step > 1"
          type="button"
          class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
          @click="prevStep"
        >
          ← Back
        </button>
        <span v-else></span>
        <button
          type="button"
          class="px-8 py-3 bg-primary text-white font-label-md disabled:opacity-40"
          :disabled="!canNext"
          @click="nextStep"
        >
          Continue →
        </button>
      </div>

      <div v-else-if="step === 4" class="flex pt-8 max-w-5xl mx-auto">
        <button
          type="button"
          class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
          @click="prevStep"
        >
          ← Back
        </button>
      </div>

      <div v-else-if="step === 5" class="flex pt-4 max-w-4xl mx-auto">
        <button
          type="button"
          class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
          @click="prevStep"
        >
          ← Back
        </button>
      </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { searchCleaners, type CleanerSearchResult } from '@/services/cleanerService'
import { createBookingRequest } from '@/services/bookingService'
import { startInitialPayment } from '@/services/payments/paymentOrchestrator'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { track } from '@/utils/analytics'
import { formatPence, toUserMessage } from '@/utils/format'
import { isCityEnabled, ROLLOUT_UNAVAILABLE_MESSAGE } from '@/config/rollout'
import { fetchPlatformSettings, getPricing, type PricingResult } from '@/services/pricingEngine'
import {
  CORE_SERVICE_CATEGORY,
  CORE_SERVICE_MATCH_KEYWORDS,
} from '@/utils/serviceCatalog'

interface BookableService {
  id: string
  cleaner_id: string
  title: string
  category: string | null
  description: string | null
  duration_minutes: number | null
  base_price_cents: number
}

const STEP_LABELS = ['Service', 'Schedule', 'Property', 'Cleaner', 'Payment']

const PROPERTY_TYPE_OPTIONS = [
  { value: 'flat_apartment', label: 'Flat / Apartment' },
  { value: 'terraced_house', label: 'Terraced House' },
  { value: 'semi_detached', label: 'Semi Detached House' },
  { value: 'detached_house', label: 'Detached House' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'other', label: 'Other' },
]

const auth = useAuthStore()
const prefsStore = useCustomerPreferencesStore()

const step = ref(1)

// Step 1
const selectedServiceSlug = ref('')

// Step 2
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dy}`
}
function localTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const earliestBooking = new Date(Date.now() + 3 * 60 * 60 * 1000)
const minDate = localDateStr(earliestBooking)
const minTimeOnEarliestDay = localTimeStr(earliestBooking)

const bookingDate = ref('')
const bookingTime = ref('09:00')

// Only enforce the 3-hour floor when the user picks the earliest allowed date
const minBookingTime = computed(() =>
  bookingDate.value === minDate ? minTimeOnEarliestDay : '00:00',
)

watch(bookingDate, (date) => {
  if (date === minDate && bookingTime.value < minTimeOnEarliestDay) {
    bookingTime.value = minTimeOnEarliestDay
  }
})

// Step 3
const propertyType = ref('')
const bedrooms = ref('')
const bathrooms = ref('')
const notes = ref('')
const addressLine1 = ref('')
const addressLine2 = ref('')
const addressCity = ref('')
const addressPostcode = ref('')
const saveAsPreferences = ref(false)
const cityOutsideRollout = computed(
  () => !!addressCity.value.trim() && !isCityEnabled(addressCity.value),
)

const prefsChanged = computed(() => {
  const p = prefsStore.preferences
  if (!p) return true
  return (
    addressLine1.value !== (p.address_line_1 ?? '') ||
    addressLine2.value !== (p.address_line_2 ?? '') ||
    addressCity.value !== (p.city ?? '') ||
    addressPostcode.value !== (p.postcode ?? '') ||
    notes.value !== (p.notes ?? '')
  )
})

// Step 4
const loadingCleaners = ref(false)
const cleaners = ref<CleanerSearchResult[]>([])
const selectedCleaner = ref<CleanerSearchResult | null>(null)
// Base price (before property multiplier) per cleaner for the selected service
const cleanerBasePrices = ref<Map<string, number>>(new Map())

// Step 5
const cleanerServices = ref<BookableService[]>([])
const paying = ref(false)
const payError = ref('')
const loadingServices = ref(false)
const currentPricing = ref<PricingResult | null>(null)
// Pre-loaded at step 4 so cleaner card estimates include the correct fee
const platformFeePercent = ref(7)
const selectedPaymentMethod = ref<string>('card')

const PAYMENT_METHOD_META: Record<string, { label: string; icon: string; description: string }> = {
  card:          { label: 'Card via Cleanlyst', icon: 'credit_card',     description: 'Secure card payment through Cleanlyst — held until job is complete.' },
  cash:          { label: 'Cash',               icon: 'payments',         description: 'Pay your cleaner in cash on the day of the clean.' },
  bank_transfer: { label: 'Bank Transfer',      icon: 'account_balance',  description: 'Transfer directly to your cleaner before or after the clean.' },
}

const availablePaymentMethods = computed(() => {
  const methods = selectedCleaner.value?.accepted_payment_methods ?? ['card']
  return methods
    .filter(m => m in PAYMENT_METHOD_META)
    .map(m => ({ value: m, ...PAYMENT_METHOD_META[m] }))
})

// --- Computed ---

const selectedServiceLabel = computed(
  () => CORE_SERVICE_CATEGORY.subServices.find((s) => s.slug === selectedServiceSlug.value)?.name ?? '',
)

const locationText = computed(() =>
  [addressLine1.value, addressLine2.value, addressCity.value, addressPostcode.value].filter(Boolean).join(', '),
)

const propertyLabel = computed(() => {
  const type = PROPERTY_TYPE_OPTIONS.find((o) => o.value === propertyType.value)?.label ?? ''
  const bed = bedrooms.value === 'studio' ? 'Studio' : bedrooms.value ? `${bedrooms.value} bed` : ''
  const bath = bathrooms.value ? `${bathrooms.value} bath` : ''
  return [type, bed, bath].filter(Boolean).join(', ')
})

function findMatchingService(slug: string): BookableService | null {
  const keywords = CORE_SERVICE_MATCH_KEYWORDS[slug]
  if (!keywords) return null
  const normalize = (v: string | null | undefined) => (v ?? '').toLowerCase()
  return (
    cleanerServices.value.find((s) => {
      const title = normalize(s.title)
      const category = normalize(s.category)
      const description = normalize(s.description)
      return keywords.some((kw) => {
        const keyword = kw.toLowerCase()
        return title.includes(keyword) || category.includes(keyword) || description.includes(keyword)
      })
    }) ?? null
  )
}

const matchedService = computed(() =>
  selectedServiceSlug.value ? findMatchingService(selectedServiceSlug.value) : null,
)

const basePricePence = computed(() => {
  if (!matchedService.value) return 0
  return matchedService.value.base_price_cents
})

const subtotalPence = computed(() => basePricePence.value)

// Always derived from the CURRENT subtotal using the known fee %, never from a
// potentially-stale currentPricing object that may have been computed for a
// different base (e.g. hourly estimate before the matched service loaded).
const bookingFeePence = computed(() =>
  Math.round(subtotalPence.value * (platformFeePercent.value / 100)),
)
const totalPence = computed(() => subtotalPence.value + bookingFeePence.value)
const bookingFeeLabel = computed(() => `Platform fee (${platformFeePercent.value}%)`)

const canNext = computed(() => {
  if (step.value === 1) return !!selectedServiceSlug.value
  if (step.value === 2) return !!bookingDate.value && !!bookingTime.value
  if (step.value === 3) return !!propertyType.value && !!bedrooms.value && !!bathrooms.value
  return true
})

// --- Helpers ---

function displayName(c: CleanerSearchResult): string {
  return c.business_name ?? c.profiles?.full_name ?? 'Cleaner'
}

function estimatedCostForCleaner(c: CleanerSearchResult): number {
  return cleanerBasePrices.value.get(c.user_id) ?? 0
}

function formatDateDisplay(date: string): string {
  if (!date) return '—'
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// --- Pricing ---

async function loadPlatformFeePercent() {
  try {
    const settings = await fetchPlatformSettings()
    platformFeePercent.value = settings.bookingFeePercent
  } catch {
    // keep default
  }
}

async function loadPricing() {
  if (subtotalPence.value <= 0) return
  currentPricing.value = await getPricing(subtotalPence.value)
  // Keep platformFeePercent in sync with what the engine resolved
  if (currentPricing.value) {
    platformFeePercent.value = currentPricing.value.bookingFeePercent
  }
}

// Re-fetch if the selected service price changes while on the payment step
watch(subtotalPence, () => {
  if (step.value === 5) loadPricing()
})

// --- Navigation ---

function nextStep() {
  if (!canNext.value) return
  if (step.value === 3) {
    step.value = 4
    loadAvailableCleaners()
    return
  }
  step.value++
}

function prevStep() {
  if (step.value === 5) {
    selectedCleaner.value = null
    cleanerServices.value = []
    currentPricing.value = null
  }
  if (step.value > 1) step.value--
}

// --- Step 4 ---

async function loadAvailableCleaners() {
  loadingCleaners.value = true
  cleaners.value = []
  cleanerBasePrices.value = new Map()
  loadPlatformFeePercent()
  try {
    const params: Parameters<typeof searchCleaners>[0] = {
      limit: 15,
      serviceSlug: selectedServiceSlug.value,
    }
    if (bookingDate.value) params.availabilityDate = bookingDate.value
    if (bookingDate.value && bookingTime.value) params.availabilityTime = bookingTime.value
    cleaners.value = await searchCleaners(params)
    await loadCleanerBasePrices(cleaners.value.map((c) => c.user_id))
  } catch {
    cleaners.value = []
  } finally {
    loadingCleaners.value = false
  }
}

async function loadCleanerBasePrices(cleanerIds: string[]) {
  if (!cleanerIds.length || !selectedServiceSlug.value) return
  const keywords = (CORE_SERVICE_MATCH_KEYWORDS[selectedServiceSlug.value] ?? []).map((k) =>
    k.toLowerCase(),
  )
  if (!keywords.length) return
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('services')
      .select('cleaner_id, title, category, description, base_price_cents')
      .in('cleaner_id', cleanerIds)
      .eq('active', true)
      .order('title', { ascending: true })
    const prices = new Map<string, number>()
    for (const svc of data ?? []) {
      if (prices.has(svc.cleaner_id)) continue
      const title = (svc.title ?? '').toLowerCase()
      const category = (svc.category ?? '').toLowerCase()
      const description = (svc.description ?? '').toLowerCase()
      if (keywords.some((kw) => title.includes(kw) || category.includes(kw) || description.includes(kw))) {
        prices.set(svc.cleaner_id, svc.base_price_cents)
      }
    }
    cleanerBasePrices.value = prices
  } catch {
    // leave map empty — cards will show "—"
  }
}

async function selectCleaner(c: CleanerSearchResult) {
  selectedCleaner.value = c
  // Default to first accepted method (card if available, otherwise first in list)
  const methods = c.accepted_payment_methods ?? ['card']
  selectedPaymentMethod.value = methods.includes('card') ? 'card' : (methods[0] ?? 'card')
  step.value = 5
  loadingServices.value = true
  try {
    // Load services FIRST so subtotalPence reflects the actual service price
    // before loadPricing() runs, so the payment total uses the selected
    // service's base price.
    // The button is disabled while loadingServices is true, preventing
    // confirmAndPay from running before services are available.
    //
    // Guard: if either network call hangs without resolving (e.g. no HTTP
    // timeout on the Supabase client), the finally block would never run and
    // the button would stay permanently disabled. Race against a 12 s timeout
    // so loadingServices always clears. Both inner calls have their own error
    // fallbacks, so a timeout here degrades gracefully to default pricing.
    await Promise.race([
      (async () => {
        await loadCleanerServices(c.user_id)
        await loadPricing()
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('service-load-timeout')), 12_000),
      ),
    ])
  } catch {
    // Intentionally silent: loadCleanerServices falls back to [], loadPricing
    // falls back to platform defaults. confirmAndPay handles missing serviceId.
  } finally {
    loadingServices.value = false
  }
}

async function loadCleanerServices(cleanerId: string) {
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('services')
      .select('id, cleaner_id, title, category, description, duration_minutes, base_price_cents')
      .eq('cleaner_id', cleanerId)
      .eq('active', true)
      .order('title')
    cleanerServices.value = (data ?? []) as BookableService[]
  } catch {
    cleanerServices.value = []
  }
}

// --- Step 5: Payment ---

async function confirmAndPay() {
  if (paying.value || !selectedCleaner.value || !auth.userId) return

  paying.value = true
  payError.value = ''

  try {
    const serviceId = matchedService.value?.id ?? cleanerServices.value[0]?.id
    if (!serviceId) throw new Error('No matching service found')

    // Ensure we have fresh pricing before creating booking
    if (!currentPricing.value) await loadPricing()
    const pricing = currentPricing.value

    const durationMinutes = matchedService.value?.duration_minutes ?? 180
    const scheduledStart = new Date(`${bookingDate.value}T${bookingTime.value}:00`)
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60000)

    const fullNotes = notes.value || null
    const titleSnapshot = selectedServiceLabel.value

    void track('BOOKING_STARTED', { user_id: auth.userId ?? undefined, role: 'customer' })
    const isOfflinePayment = selectedPaymentMethod.value !== 'card'

    // Offline payments (cash/bank transfer) use service price only — no platform fee
    const quoteCentsForBooking = isOfflinePayment
      ? basePricePence.value
      : (pricing?.totalCustomerCents ?? totalPence.value)

    const booking = await createBookingRequest({
      customerId: auth.userId,
      cleanerId: selectedCleaner.value.user_id,
      serviceId,
      serviceTitleSnapshot: titleSnapshot,
      categorySnapshot: matchedService.value?.category ?? null,
      descriptionSnapshot: matchedService.value?.description ?? null,
      locationText: locationText.value || 'Address not provided',
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      quoteCents: quoteCentsForBooking,
      cleanerPayoutCents: pricing?.cleanerPayoutCents ?? subtotalPence.value,
      currency: selectedCleaner.value.currency,
      notes: fullNotes,
      durationMinutes,
      propertyType: propertyType.value || null,
      bedrooms: bedrooms.value || null,
      bathrooms: bathrooms.value || null,
      paymentMethod: selectedPaymentMethod.value,
      financials: pricing && !isOfflinePayment
        ? {
            servicePriceCents: pricing.servicePriceCents,
            bookingFeeCents: pricing.bookingFeeCents,
            cleanerCommissionCents: pricing.cleanerCommissionCents,
            cleanerPayoutCents: pricing.cleanerPayoutCents,
            platformRevenueCents: pricing.platformRevenueCents,
            bookingFeePercent: pricing.bookingFeePercent,
            cleanerCommissionPercent: pricing.cleanerCommissionPercent,
          }
        : null,
    })

    if (!booking?.id) throw new Error('Booking creation failed — no ID returned')

    void track('CHECKOUT_STARTED', { booking_id: booking.id, user_id: auth.userId ?? undefined })

    // Save address preferences before leaving the page (best-effort, non-fatal)
    if (saveAsPreferences.value) {
      try {
        await prefsStore.save({
          address_line_1: addressLine1.value || null,
          address_line_2: addressLine2.value || null,
          city: addressCity.value || null,
          postcode: addressPostcode.value || null,
          notes: notes.value || null,
        })
      } catch {
        // Non-fatal
      }
    }

    if (isOfflinePayment) {
      // No Stripe checkout for cash/bank transfer — redirect to booking detail
      window.location.href = `/customer/bookings/${booking.id}`
      return
    }

    const paymentResult = await startInitialPayment(booking.id)
    // Always redirects to Stripe Checkout — browser navigates away.
    // The user returns to /checkout/success after payment.
    if (paymentResult.redirectUrl) {
      window.location.href = paymentResult.redirectUrl
    }
  } catch (e) {
    payError.value = toUserMessage(e, 'Payment failed. Please try again.')
  } finally {
    paying.value = false
  }
}

// --- Mount ---

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  await prefsStore.load()
  const p = prefsStore.preferences
  if (p) {
    addressLine1.value = p.address_line_1 ?? ''
    addressLine2.value = p.address_line_2 ?? ''
    addressCity.value = p.city ?? ''
    addressPostcode.value = p.postcode ?? ''
    notes.value = p.notes ?? ''
    propertyType.value = p.property_type ?? ''
    bedrooms.value = p.bedrooms ?? ''
    bathrooms.value = p.bathrooms ?? ''
  }
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  vertical-align: middle;
}
.filled-icon {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
.star-filled {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
.success-icon {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% { opacity: 1; }
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
