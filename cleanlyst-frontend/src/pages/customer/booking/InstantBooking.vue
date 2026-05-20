<template>
  <main class="pt-32 pb-24 px-6 max-w-7xl mx-auto">
    <!-- Loading -->
    <div v-if="pageLoading" class="flex flex-col items-center gap-4 py-24">
      <div class="loading-spinner"></div>
      <p class="font-body text-body text-secondary">Loading cleaner details…</p>
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="text-center py-24">
      <p class="font-body text-body text-red-600 mb-4">{{ loadError }}</p>
      <router-link :to="{ name: 'BookCleaner' }" class="underline font-label-md text-primary">
        ← Back to search
      </router-link>
    </div>

    <!-- No instant-bookable services -->
    <div v-else-if="availableCoreServices.length === 0 && !pageLoading" class="text-center py-24">
      <span class="material-symbols-outlined text-5xl text-outline-variant block mb-4"
        >event_busy</span
      >
      <p class="font-label-md text-label-md text-on-surface mb-2">Instant booking unavailable</p>
      <p class="text-caption text-on-surface-variant mb-6">
        This cleaner hasn't listed any standard services yet. Send them a custom request instead.
      </p>
      <router-link
        :to="{ name: 'RequestBooking', query: { cleanerId: cleanerId } }"
        class="px-8 py-3 bg-primary text-on-primary font-label-md"
      >
        Send Custom Request
      </router-link>
    </div>

    <!-- Confirmed -->
    <div v-else-if="confirmed" class="max-w-lg mx-auto text-center py-24 space-y-6">
      <span class="material-symbols-outlined text-6xl text-green-600 block confirmed-icon"
        >check_circle</span
      >
      <h1 class="font-h1 text-h1 text-primary">Booking Confirmed!</h1>
      <p class="font-body text-body text-secondary">
        Payment received. Your cleaner will review and confirm shortly.
      </p>
      <router-link
        :to="{ name: 'CustomerBookingDetails', params: { bookingId: confirmedBookingId } }"
        class="inline-block px-8 py-3 bg-primary text-on-primary font-label-md"
      >
        View Booking
      </router-link>
    </div>

    <!-- Wizard -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <!-- Left: steps -->
      <div class="lg:col-span-7 space-y-10">
        <!-- Header + step indicator -->
        <section>
          <h1 class="font-h1 text-h1 text-primary mb-2">Instant Booking</h1>
          <p class="font-body text-body text-secondary mb-6">
            Fixed pricing. Pay now, cleaner confirms within the hour.
          </p>
          <div class="flex items-center gap-2">
            <template v-for="(label, i) in STEP_LABELS" :key="i">
              <div
                :class="[
                  'flex items-center gap-1.5 text-xs font-medium',
                  step === i + 1
                    ? 'text-primary'
                    : step > i + 1
                      ? 'text-green-700'
                      : 'text-on-surface-variant',
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
                  <span v-if="step > i + 1" class="material-symbols-outlined text-[12px]"
                    >check</span
                  >
                  <span v-else>{{ i + 1 }}</span>
                </span>
                <span class="hidden sm:inline">{{ label }}</span>
              </div>
              <div
                v-if="i < STEP_LABELS.length - 1"
                class="flex-1 h-px bg-outline-variant max-w-8"
              ></div>
            </template>
          </div>
        </section>

        <!-- Step 1: Service -->
        <section v-if="step === 1" class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Choose a Service</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              v-for="svc in availableCoreServices"
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
              <p class="text-caption font-caption text-secondary line-clamp-2">
                {{ svc.description }}
              </p>
              <p
                v-if="cleanerServicePrice(svc.slug) > 0"
                class="font-label-md text-label-md text-primary"
              >
                from {{ formatPence(cleanerServicePrice(svc.slug)) }}
              </p>
            </button>
          </div>
        </section>

        <!-- Step 2: Schedule -->
        <section v-else-if="step === 2" class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Date &amp; Time</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block font-label-md text-label-md text-primary mb-2">Date</label>
              <input
                v-model="bookingDate"
                type="date"
                :min="minDate"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
              />
            </div>
            <div>
              <label class="block font-label-md text-label-md text-primary mb-2">Start Time</label>
              <input
                v-model="bookingTime"
                type="time"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
              />
            </div>
          </div>
          <div v-if="!matchedService?.duration_minutes">
            <label class="block font-label-md text-label-md text-primary mb-2">Duration</label>
            <select
              v-model.number="durationHours"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            >
              <option :value="1">1 hour</option>
              <option :value="2">2 hours</option>
              <option :value="3">3 hours</option>
              <option :value="4">4 hours</option>
              <option :value="5">5 hours</option>
              <option :value="6">6 hours</option>
              <option :value="8">8 hours (full day)</option>
            </select>
          </div>
        </section>

        <!-- Step 3: Property size -->
        <section v-else-if="step === 3" class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Property Size</h2>
          <p class="font-body text-body text-secondary">
            Select your property type to get the right price.
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <button
              v-for="opt in PROPERTY_SIZE_OPTIONS"
              :key="opt.value"
              type="button"
              :class="[
                'p-4 border text-center transition-colors',
                propertySize === opt.value
                  ? 'border-primary bg-surface-variant'
                  : 'border-outline-variant bg-white hover:border-primary',
              ]"
              @click="propertySize = opt.value"
            >
              <p class="font-label-md text-label-md text-primary text-sm">{{ opt.label }}</p>
              <p class="text-caption font-caption text-secondary text-xs mt-1">
                {{ formatPence(propertySizeBasePrice(opt.value)) }}
              </p>
            </button>
          </div>
        </section>

        <!-- Step 4: Add-ons -->
        <section v-else-if="step === 4" class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Add-ons</h2>
          <p class="font-body text-body text-secondary">Optional extras added to your clean.</p>
          <div class="space-y-3">
            <label
              v-for="addon in ADDON_CATEGORY.subServices"
              :key="addon.slug"
              :class="[
                'flex items-center gap-4 p-4 border cursor-pointer transition-colors',
                selectedAddOns.includes(addon.slug)
                  ? 'border-primary bg-surface-variant'
                  : 'border-outline-variant bg-white hover:border-primary',
              ]"
            >
              <input
                type="checkbox"
                :value="addon.slug"
                v-model="selectedAddOns"
                class="w-4 h-4 accent-zinc-900"
              />
              <span class="material-symbols-outlined text-xl text-primary">{{
                addon.icon ?? 'add'
              }}</span>
              <div class="flex-1">
                <p class="font-label-md text-label-md text-primary">{{ addon.name }}</p>
                <p class="text-caption font-caption text-secondary">{{ addon.description }}</p>
              </div>
              <span class="font-label-md text-label-md text-primary">
                + {{ formatPence(ADD_ON_PRICES_PENCE[addon.slug] ?? 0) }}
              </span>
            </label>
          </div>
          <p class="text-caption font-caption text-secondary">
            Skip this step if you don't need any add-ons.
          </p>
        </section>

        <!-- Step 5: Summary & pay -->
        <section v-else-if="step === 5" class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Review &amp; Pay</h2>
          <div class="border border-outline-variant bg-white p-6 space-y-4">
            <div class="flex justify-between items-center">
              <span class="font-body text-body text-secondary">{{ selectedServiceName }}</span>
              <span class="font-label-md text-label-md text-primary">{{
                formatPence(propertySizeBasePrice(propertySize))
              }}</span>
            </div>
            <div
              v-for="slug in selectedAddOns"
              :key="slug"
              class="flex justify-between items-center"
            >
              <span class="font-body text-body text-secondary">{{ addonName(slug) }}</span>
              <span class="font-label-md text-label-md text-primary"
                >+ {{ formatPence(ADD_ON_PRICES_PENCE[slug] ?? 0) }}</span
              >
            </div>
            <div class="pt-4 border-t border-outline-variant space-y-2">
              <div class="flex justify-between items-center">
                <span class="font-body text-body text-secondary">Subtotal</span>
                <span class="font-body text-body text-primary">{{
                  formatPence(subtotalPence)
                }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-body text-body text-secondary">Service Fee (7%)</span>
                <span class="font-body text-body text-primary">{{
                  formatPence(serviceFeePence)
                }}</span>
              </div>
              <div class="flex justify-between items-center pt-2 border-t border-outline-variant">
                <span class="font-h2 text-h2 text-primary">Total</span>
                <span class="font-h2 text-h2 text-primary">{{ formatPence(totalPence) }}</span>
              </div>
            </div>
          </div>
          <p v-if="payError" class="text-caption text-red-600">{{ payError }}</p>
          <button
            class="w-full py-4 bg-primary text-white font-label-md disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="paying"
            @click="checkout"
          >
            <span v-if="paying" class="loading-spinner-sm"></span>
            {{ paying ? 'Processing payment…' : `Confirm & Pay ${formatPence(totalPence)}` }}
          </button>
          <p class="text-center text-caption font-caption text-secondary">
            Payment held securely. Released to cleaner after job completion.
          </p>
        </section>

        <!-- Navigation -->
        <div v-if="step <= 5" class="flex items-center justify-between pt-2">
          <button
            v-if="step > 1"
            class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
            type="button"
            @click="prevStep"
          >
            ← Back
          </button>
          <span v-else></span>
          <button
            v-if="step < 5"
            class="px-8 py-3 bg-primary text-white font-label-md disabled:opacity-40"
            type="button"
            :disabled="!canNext"
            @click="nextStep"
          >
            Continue →
          </button>
        </div>
      </div>

      <!-- Right: sticky summary -->
      <aside class="lg:col-span-5">
        <div class="sticky top-24 space-y-6">
          <div class="bg-white border border-outline-variant p-6 space-y-6">
            <!-- Cleaner info -->
            <div class="flex items-center gap-4">
              <div
                class="h-14 w-14 rounded-full overflow-hidden bg-surface-container border border-outline-variant flex items-center justify-center flex-shrink-0"
              >
                <img
                  v-if="cleaner?.profiles?.avatar_url"
                  class="w-full h-full object-cover"
                  :src="cleaner.profiles.avatar_url"
                  :alt="cleanerName"
                />
                <span v-else class="material-symbols-outlined text-on-surface-variant text-2xl"
                  >person</span
                >
              </div>
              <div>
                <p class="font-label-md text-label-md text-primary">{{ cleanerName }}</p>
                <div v-if="cleaner" class="flex items-center gap-1 mt-0.5">
                  <span class="material-symbols-outlined text-[14px] star-filled">star</span>
                  <span class="text-caption font-caption text-secondary">
                    {{ cleaner.average_rating.toFixed(1) }} ({{ cleaner.review_count }} reviews)
                  </span>
                </div>
              </div>
            </div>

            <!-- Booking summary -->
            <div class="border-t border-outline-variant pt-4 space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-secondary">Service</span>
                <span class="text-primary font-medium">{{ selectedServiceName || '—' }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-secondary">Date</span>
                <span class="text-primary font-medium">{{
                  bookingDate ? formatDateDisplay(bookingDate) : '—'
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-secondary">Time</span>
                <span class="text-primary font-medium">{{ bookingTime || '—' }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-secondary">Property</span>
                <span class="text-primary font-medium">{{ selectedPropertyLabel || '—' }}</span>
              </div>
              <div v-if="selectedAddOns.length > 0" class="flex justify-between text-sm">
                <span class="text-secondary">Add-ons</span>
                <span class="text-primary font-medium">{{ selectedAddOns.length }} selected</span>
              </div>
            </div>

            <!-- Price -->
            <div v-if="subtotalPence > 0" class="border-t border-outline-variant pt-4 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-secondary">Subtotal</span>
                <span class="text-primary">{{ formatPence(subtotalPence) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-secondary">Service Fee</span>
                <span class="text-primary">{{ formatPence(serviceFeePence) }}</span>
              </div>
              <div
                class="flex justify-between font-h2 text-h2 pt-2 border-t border-outline-variant"
              >
                <span>Total</span>
                <span>{{ formatPence(totalPence) }}</span>
              </div>
            </div>
          </div>

          <div
            class="bg-surface-container-low p-5 border border-outline-variant flex items-start gap-3"
          >
            <span class="material-symbols-outlined text-primary mt-0.5">shield</span>
            <div>
              <p class="font-label-md text-label-md text-primary text-sm">Cleanlyst Guarantee</p>
              <p class="text-caption font-caption text-secondary text-xs mt-1">
                Your payment is held securely and only released after the job is completed.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCleanerPublicProfile, type CleanerSearchResult } from '@/services/cleanerService'
import { createBookingRequest } from '@/services/bookingService'
import { processPaymentDirect } from '@/services/bookingService'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { formatPence } from '@/utils/format'
import {
  ADDON_CATEGORY,
  ADD_ON_PRICES_PENCE,
  CORE_SERVICE_CATEGORY,
  CORE_SERVICE_MATCH_KEYWORDS,
  PROPERTY_SIZE_OPTIONS,
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

const STEP_LABELS = ['Service', 'Schedule', 'Property', 'Add-ons', 'Pay']

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const prefsStore = useCustomerPreferencesStore()

const cleanerId = String(route.query.cleanerId ?? '')
const pageLoading = ref(true)
const loadError = ref('')
const paying = ref(false)
const payError = ref('')
const confirmed = ref(false)
const confirmedBookingId = ref('')

const step = ref(1)
const cleaner = ref<CleanerSearchResult | null>(null)
const cleanerServices = ref<BookableService[]>([])

const selectedServiceSlug = ref('')
const bookingDate = ref('')
const bookingTime = ref('09:00')
const durationHours = ref(3)
const propertySize = ref<string>('2bed')
const selectedAddOns = ref<string[]>([])

const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const cleanerName = computed(
  () => cleaner.value?.business_name ?? cleaner.value?.profiles?.full_name ?? 'Cleaner',
)

function findMatchingService(slug: string): BookableService | null {
  const keywords = CORE_SERVICE_MATCH_KEYWORDS[slug]
  if (!keywords) return null

  const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase()

  return (
    cleanerServices.value.find((s) => {
      const title = normalize(s.title)
      const category = normalize(s.category)
      const description = normalize(s.description)

      return keywords.some((kw) => {
        const keyword = kw.toLowerCase()
        return (
          title.includes(keyword) || category.includes(keyword) || description.includes(keyword)
        )
      })
    }) ?? null
  )
}

const availableCoreServices = computed(() =>
  CORE_SERVICE_CATEGORY.subServices.filter((sub) => findMatchingService(sub.slug) !== null),
)

const matchedService = computed<BookableService | null>(() =>
  selectedServiceSlug.value ? findMatchingService(selectedServiceSlug.value) : null,
)

const selectedServiceName = computed(
  () =>
    CORE_SERVICE_CATEGORY.subServices.find((s) => s.slug === selectedServiceSlug.value)?.name ?? '',
)

const selectedPropertyLabel = computed(
  () => PROPERTY_SIZE_OPTIONS.find((o) => o.value === propertySize.value)?.label ?? '',
)

function cleanerServicePrice(slug: string): number {
  const svc = findMatchingService(slug)
  if (svc) return svc.base_price_cents
  return (cleaner.value?.hourly_rate_cents ?? 0) * 2
}

function propertySizeBasePrice(sizeValue: string): number {
  const base = cleanerServicePrice(selectedServiceSlug.value)
  const multiplier = PROPERTY_SIZE_OPTIONS.find((o) => o.value === sizeValue)?.multiplier ?? 1.0
  return Math.round(base * multiplier)
}

const addOnTotalPence = computed(() =>
  selectedAddOns.value.reduce((sum, slug) => sum + (ADD_ON_PRICES_PENCE[slug] ?? 0), 0),
)

const subtotalPence = computed(
  () => propertySizeBasePrice(propertySize.value) + addOnTotalPence.value,
)
const serviceFeePence = computed(() => Math.round(subtotalPence.value * 0.07))
const totalPence = computed(() => subtotalPence.value + serviceFeePence.value)

function addonName(slug: string): string {
  return ADDON_CATEGORY.subServices.find((s) => s.slug === slug)?.name ?? slug
}

const canNext = computed(() => {
  if (step.value === 1) return !!selectedServiceSlug.value
  if (step.value === 2) return !!bookingDate.value && !!bookingTime.value
  if (step.value === 3) return !!propertySize.value
  return true
})

function nextStep() {
  if (canNext.value && step.value < 5) step.value++
}

function prevStep() {
  if (step.value > 1) step.value--
}

function formatDateDisplay(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

async function checkout() {
  if (paying.value || !cleaner.value || !matchedService.value || !auth.userId) return
  paying.value = true
  payError.value = ''

  try {
    const scheduledStart = new Date(`${bookingDate.value}T${bookingTime.value}:00`)
    const durationMinutes = matchedService.value.duration_minutes ?? durationHours.value * 60
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000)

    const prefs = prefsStore.preferences
    const location =
      [prefs?.address_line_1, prefs?.city, prefs?.postcode].filter(Boolean).join(', ') ||
      'Address not provided'

    const cleanerPayoutCents = subtotalPence.value
    const serviceTitleSnapshot = `${selectedServiceName.value}${selectedAddOns.value.length > 0 ? ' + ' + selectedAddOns.value.map(addonName).join(', ') : ''}`

    const { id: bookingId } = await createBookingRequest({
      customerId: auth.userId,
      cleanerId: cleaner.value.user_id,
      serviceId: matchedService.value.id,
      serviceTitleSnapshot,
      categorySnapshot: matchedService.value.category,
      descriptionSnapshot: matchedService.value.description,
      locationText: location,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      quoteCents: totalPence.value,
      cleanerPayoutCents,
      currency: cleaner.value.currency,
      notes:
        selectedAddOns.value.length > 0
          ? `Add-ons requested: ${selectedAddOns.value.map(addonName).join(', ')}`
          : null,
      durationMinutes,
      hourlyRateCents: cleaner.value.hourly_rate_cents ?? null,
    })

    // Dummy payment delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await processPaymentDirect(bookingId)

    confirmedBookingId.value = bookingId
    confirmed.value = true
  } catch (e) {
    payError.value = e instanceof Error ? e.message : 'Failed to process payment.'
  } finally {
    paying.value = false
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  if (!cleanerId) {
    loadError.value = 'No cleaner selected.'
    pageLoading.value = false
    return
  }
  try {
    const [cleanerData] = await Promise.all([getCleanerPublicProfile(cleanerId), prefsStore.load()])
    if (!cleanerData) {
      loadError.value = 'Cleaner not found.'
      pageLoading.value = false
      return
    }
    cleaner.value = cleanerData

    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('services')
      .select('id, cleaner_id, title, category, description, duration_minutes, base_price_cents')
      .eq('cleaner_id', cleanerData.user_id)
      .eq('active', true)
      .order('title')
    if (error) throw error
    cleanerServices.value = (data ?? []) as BookableService[]

    // Pre-select first available service
    if (availableCoreServices.value.length > 0) {
      selectedServiceSlug.value = availableCoreServices.value[0]!.slug
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load cleaner.'
  } finally {
    pageLoading.value = false
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
.confirmed-icon {
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
.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
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
  to {
    transform: rotate(360deg);
  }
}
</style>
