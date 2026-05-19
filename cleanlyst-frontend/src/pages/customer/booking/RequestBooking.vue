<template>
  <main class="pt-32 pb-24 px-6 max-w-7xl mx-auto">
    <!-- Loading / Error states -->
    <div v-if="pageLoading" class="flex flex-col items-center gap-4 py-24">
      <div class="loading-spinner"></div>
      <p class="font-body text-body text-secondary">Loading cleaner details…</p>
    </div>

    <div v-else-if="loadError" class="text-center py-24">
      <p class="font-body text-body text-red-600 mb-4">{{ loadError }}</p>
      <router-link :to="{ name: 'BookCleaner' }" class="underline font-label-md text-primary">
        ← Back to search
      </router-link>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <!-- Left Column: Booking Form -->
      <div class="lg:col-span-7 space-y-12">
        <section>
          <h1 class="font-h1 text-h1 text-primary mb-4">Request Your Booking</h1>
          <p class="font-body text-body text-secondary max-w-lg">
            Complete the details below to finalize your request. Your cleaner will review and
            confirm within 24 hours.
          </p>
        </section>

        <!-- Service Address -->
        <section class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Service Address</h2>
          <div
            v-if="addressLine"
            class="p-6 bg-white border border-outline-variant rounded-lg flex items-start gap-4"
          >
            <span class="material-symbols-outlined text-secondary mt-1">location_on</span>
            <div class="space-y-1">
              <p class="font-body text-body text-secondary">{{ addressLine }}</p>
            </div>
          </div>
          <div v-else class="p-6 bg-surface-container-low border border-outline-variant rounded-lg">
            <p class="font-body text-body text-secondary mb-3">No address saved yet.</p>
            <router-link
              :to="{ name: 'CustomerPreferences' }"
              class="font-label-md text-label-md text-primary underline"
              >Set your address in preferences →</router-link
            >
          </div>
        </section>

        <!-- Service Selection -->
        <section class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Service</h2>
          <div
            v-if="servicesLoading"
            class="p-6 bg-surface-container-low border border-outline-variant rounded-lg"
          >
            <p class="font-body text-body text-secondary">Loading services…</p>
          </div>
          <div
            v-else-if="availableServices.length === 0"
            class="p-6 bg-surface-container-low border border-outline-variant rounded-lg"
          >
            <p class="font-body text-body text-secondary">
              This cleaner does not have any active services available for booking.
            </p>
          </div>
          <div v-else>
            <label for="service-id" class="block font-label-md text-label-md text-primary mb-2">
              Choose a service
            </label>
            <select
              id="service-id"
              v-model="selectedServiceId"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none rounded-lg"
            >
              <option value="" disabled>Select a service</option>
              <option v-for="service in availableServices" :key="service.id" :value="service.id">
                {{ service.title }} · {{ formatPence(service.base_price_cents) }}
              </option>
            </select>
            <p
              v-if="selectedService?.description"
              class="text-caption font-caption text-secondary mt-2"
            >
              {{ selectedService.description }}
            </p>
          </div>
        </section>

        <!-- Date & Time -->
        <section class="space-y-6">
          <h2 class="font-h2 text-h2 text-primary">Date &amp; Time</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="booking-date" class="block font-label-md text-label-md text-primary mb-2">
                Date
              </label>
              <input
                id="booking-date"
                v-model="bookingDate"
                type="date"
                :min="minDate"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none rounded-lg"
              />
            </div>
            <div>
              <label for="booking-time" class="block font-label-md text-label-md text-primary mb-2">
                Start Time
              </label>
              <input
                id="booking-time"
                v-model="bookingTime"
                type="time"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none rounded-lg"
              />
            </div>
          </div>
          <div v-if="!selectedService?.duration_minutes">
            <label
              for="booking-duration"
              class="block font-label-md text-label-md text-primary mb-2"
            >
              Duration
            </label>
            <select
              id="booking-duration"
              v-model.number="durationHours"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none rounded-lg"
            >
              <option :value="1">1 hour</option>
              <option :value="2">2 hours</option>
              <option :value="3">3 hours</option>
              <option :value="4">4 hours</option>
              <option :value="5">5 hours</option>
              <option :value="6">6 hours</option>
            </select>
          </div>
        </section>

        <!-- Notes to Cleaner -->
        <section class="space-y-4">
          <label for="notes" class="block font-label-md text-label-md text-primary">
            Notes to Cleaner (Optional)
          </label>
          <textarea
            id="notes"
            v-model="notes"
            class="w-full p-4 border border-outline-variant rounded-lg focus:ring-0 focus:border-primary font-body text-body bg-white placeholder:text-outline"
            placeholder="e.g. 'Key is under the mat', 'Focus on the kitchen cabinets', 'Please mind the dog'"
            rows="5"
          ></textarea>
          <p class="text-caption font-caption text-secondary">
            Specific instructions help your cleaner provide the best service.
          </p>
        </section>

        <p v-if="submitError" class="text-caption text-red-600">{{ submitError }}</p>

        <!-- Mobile CTA -->
        <div class="lg:hidden space-y-4 pt-8">
          <button
            class="w-full py-4 bg-primary text-white font-label-md text-label-md rounded-lg active:scale-[0.98] transition-transform disabled:opacity-50"
            :disabled="submitting || !canSubmit"
            @click="submitBooking"
          >
            {{ submitting ? 'Submitting…' : 'Submit Booking Request' }}
          </button>
          <p class="text-center text-caption font-caption text-secondary">
            You won't be charged until the cleaner confirms.
          </p>
        </div>
      </div>

      <!-- Right Column: Summary Sticky -->
      <aside class="lg:col-span-5">
        <div class="sticky top-24 space-y-8">
          <div class="bg-white border border-outline-variant rounded-lg p-8 space-y-8">
            <h2 class="font-h2 text-h2 text-primary">Service Summary</h2>
            <div class="flex items-center gap-4">
              <div
                class="h-16 w-16 rounded-full overflow-hidden bg-surface-container border border-outline-variant flex items-center justify-center"
              >
                <img
                  v-if="cleaner?.profiles?.avatar_url"
                  class="w-full h-full object-cover"
                  :src="cleaner.profiles.avatar_url"
                  :alt="cleanerName"
                />
                <span v-else class="material-symbols-outlined text-on-surface-variant text-3xl"
                  >person</span
                >
              </div>
              <div>
                <p class="font-label-md text-label-md text-primary">{{ cleanerName }}</p>
                <div v-if="cleaner" class="flex items-center gap-1 text-primary">
                  <span class="material-symbols-outlined text-[16px] star-filled">star</span>
                  <span class="text-caption font-caption">
                    {{ cleaner.average_rating.toFixed(1) }} ({{ cleaner.review_count }} reviews)
                  </span>
                </div>
              </div>
            </div>
            <div class="space-y-4 pt-4 border-t border-surface-variant">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary">calendar_today</span>
                  <span class="font-body text-body text-secondary">{{
                    bookingDate || 'Select date'
                  }}</span>
                </div>
                <span class="font-label-md text-label-md text-primary">{{
                  bookingTime || '—'
                }}</span>
              </div>
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary">schedule</span>
                  <span class="font-body text-body text-secondary">Duration</span>
                </div>
                <span class="font-label-md text-label-md text-primary">{{ durationLabel }}</span>
              </div>
              <div
                v-if="selectedService || cleaner?.hourly_rate_cents"
                class="flex justify-between items-center"
              >
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary">cleaning_services</span>
                  <span class="font-body text-body text-secondary">
                    {{ selectedService ? 'Service' : 'Rate' }}
                  </span>
                </div>
                <span class="font-label-md text-label-md text-primary">
                  {{ selectedService ? selectedService.title : hourlyRateLabel }}
                </span>
              </div>
            </div>
            <div class="pt-6 space-y-4 border-t border-surface-variant">
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
              <div class="flex justify-between items-center">
                <span class="font-h2 text-h2 text-primary">Total</span>
                <span class="font-h2 text-h2 text-primary">{{ formatPence(totalPence) }}</span>
              </div>
            </div>
            <button
              class="hidden lg:block w-full py-4 bg-primary text-white font-label-md text-label-md rounded-lg active:scale-[0.98] transition-transform disabled:opacity-50"
              :disabled="submitting || !canSubmit"
              @click="submitBooking"
            >
              {{ submitting ? 'Submitting…' : 'Submit Booking Request' }}
            </button>
            <p class="hidden lg:block text-center text-caption font-caption text-secondary">
              You won't be charged until the cleaner confirms.
            </p>
          </div>
          <div
            class="bg-surface-container-low p-6 rounded-lg border border-outline-variant flex items-start gap-4"
          >
            <span class="material-symbols-outlined text-primary">shield</span>
            <div>
              <p class="font-label-md text-label-md text-primary">Cleanlyst Guarantee</p>
              <p class="text-caption font-caption text-secondary">
                Your payment is held securely and only released 24 hours after the service is
                completed.
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
import { getCleanerAvailabilityForDate } from '@/services/availabilityService'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { formatPence } from '@/utils/format'

interface BookableService {
  id: string
  cleaner_id: string
  title: string
  category: string | null
  description: string | null
  duration_minutes: number | null
  base_price_cents: number
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const prefsStore = useCustomerPreferencesStore()

const pageLoading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const submitError = ref('')
const servicesLoading = ref(false)

const cleaner = ref<CleanerSearchResult | null>(null)
const availableServices = ref<BookableService[]>([])
const selectedServiceId = ref('')
const bookingDate = ref('')
const bookingTime = ref('09:00')
const durationHours = ref(3)
const notes = ref('')

const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const cleanerName = computed(
  () => cleaner.value?.business_name ?? cleaner.value?.profiles?.full_name ?? 'Cleaner',
)

const selectedService = computed(
  () => availableServices.value.find((service) => service.id === selectedServiceId.value) ?? null,
)

const addressLine = computed(() => {
  const p = prefsStore.preferences
  if (!p) return ''
  const parts = [p.address_line_1, p.address_line_2, p.city, p.postcode].filter(Boolean)
  return parts.join(', ')
})

const subtotalPence = computed(
  () =>
    selectedService.value?.base_price_cents ??
    (cleaner.value?.hourly_rate_cents ?? 0) * durationHours.value,
)

const serviceFeePence = computed(() => Math.round(subtotalPence.value * 0.07))

const totalPence = computed(() => subtotalPence.value + serviceFeePence.value)

const hourlyRateLabel = computed(() =>
  cleaner.value?.hourly_rate_cents
    ? `${formatPence(cleaner.value.hourly_rate_cents)}/hr`
    : 'Not set',
)

const durationLabel = computed(() => {
  const minutes = selectedService.value?.duration_minutes
  if (!minutes) return `${durationHours.value} hour${durationHours.value !== 1 ? 's' : ''}`
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  return `${minutes} minutes`
})

const canSubmit = computed(
  () =>
    !!bookingDate.value &&
    !!bookingTime.value &&
    !!cleaner.value &&
    !!selectedService.value &&
    !servicesLoading.value,
)

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  const cleanerId = route.query.cleanerId as string
  if (!cleanerId) {
    loadError.value = 'No cleaner selected.'
    pageLoading.value = false
    return
  }
  try {
    const [cleanerData] = await Promise.all([getCleanerPublicProfile(cleanerId), prefsStore.load()])
    if (!cleanerData) {
      loadError.value = 'Cleaner not found.'
    } else {
      cleaner.value = cleanerData
      await loadCleanerServices(cleanerData.user_id)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load cleaner.'
  } finally {
    pageLoading.value = false
  }
})

async function loadCleanerServices(cleanerId: string) {
  servicesLoading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('services')
      .select('id, cleaner_id, title, category, description, duration_minutes, base_price_cents')
      .eq('cleaner_id', cleanerId)
      .eq('active', true)
      .order('category')
      .order('title')
    if (error) throw error
    availableServices.value = (data ?? []) as BookableService[]
    selectedServiceId.value = availableServices.value[0]?.id ?? ''
  } finally {
    servicesLoading.value = false
  }
}

async function validateAvailability(
  cleanerId: string,
  date: string,
  time: string,
): Promise<string | null> {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const slots = await getCleanerAvailabilityForDate(cleanerId, date)
  if (slots.length === 0) {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay()
    return `This cleaner is not available on ${dayNames[dayOfWeek]}. Please choose a different date.`
  }

  const matched = slots.some((slot) => {
    const startHHMM = slot.start_time.slice(0, 5)
    const endHHMM = slot.end_time.slice(0, 5)
    return time >= startHHMM && time < endHHMM
  })

  if (!matched) {
    const ranges = slots.map(
      (slot) => `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
    )
    return `This cleaner is available during the following times: ${ranges.join(', ')}. Please choose a time inside one of these windows.`
  }

  return null
}

async function checkConflict(
  cleanerId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
): Promise<boolean> {
  const supabase = requireSupabase()
  // Uses a security-definer RPC so customers can check cleaner conflicts
  // without needing direct read access to all bookings rows.
  const { data, error } = await supabase.rpc('cleaner_has_booking_conflict', {
    p_cleaner_id: cleanerId,
    p_start: scheduledStart.toISOString(),
    p_end: scheduledEnd.toISOString(),
  })
  if (error) throw error
  return data === true
}

async function submitBooking() {
  if (!canSubmit.value || !auth.userId || !cleaner.value || !selectedService.value) return
  submitting.value = true
  submitError.value = ''

  try {
    const scheduledStart = new Date(`${bookingDate.value}T${bookingTime.value}:00`)
    const durationMinutes = selectedService.value.duration_minutes ?? durationHours.value * 60
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000)

    // Validate the cleaner is available at the requested time
    const availabilityError = await validateAvailability(
      cleaner.value.user_id,
      bookingDate.value,
      bookingTime.value,
    )
    if (availabilityError) {
      submitError.value = availabilityError
      return
    }

    // Check for a conflicting booking (best-effort; skip gracefully if RPC unavailable)
    let hasConflict = false
    try {
      hasConflict = await checkConflict(cleaner.value.user_id, scheduledStart, scheduledEnd)
    } catch {
      // RPC may not be deployed yet — treat as no conflict and allow the booking through
    }
    if (hasConflict) {
      submitError.value =
        'This cleaner is unavailable for your selected time. Please choose a different time or date.'
      return
    }

    const prefs = prefsStore.preferences
    const location =
      [prefs?.address_line_1, prefs?.city, prefs?.postcode].filter(Boolean).join(', ') ||
      'Address not provided'

    await createBookingRequest({
      customerId: auth.userId,
      cleanerId: cleaner.value.user_id,
      serviceId: selectedService.value.id,
      serviceTitleSnapshot: selectedService.value.title,
      categorySnapshot: selectedService.value.category,
      descriptionSnapshot: selectedService.value.description,
      locationText: location,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      quoteCents: totalPence.value,
      cleanerPayoutCents: subtotalPence.value,
      currency: cleaner.value.currency,
      notes: notes.value || null,
      durationMinutes,
      hourlyRateCents: cleaner.value.hourly_rate_cents ?? null,
    })
    router.push({ name: 'CustomerBookings' })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Failed to submit booking.'
  } finally {
    submitting.value = false
  }
}
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

.star-filled {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
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
</style>
