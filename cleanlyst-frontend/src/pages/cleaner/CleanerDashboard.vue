<template>
  <DashboardLayout :links="cleanerDashboardLinks" main-label="Cleaner dashboard">
    <CleanerDashboardSection
      v-if="activeRouteName === 'CleanerDashboard'"
      :earningsToDate="earningsToDate"
      :bookingTotals="bookingTotals"
      :ratingLabel="ratingLabel"
      :errorMessage="errorMessage"
    />
    <CleanerBookingsSection
      v-if="activeRouteName === 'CleanerBookings'"
      :bookingTotals="bookingTotals"
      :errorMessage="errorMessage"
      :loading="loading"
      :bookings="bookings"
      :acceptBooking="acceptBooking"
      :declineBooking="declineBooking"
      :markCompleted="markCompleted"
      :formatDate="formatDate"
      :formatStatus="formatStatus"
    />
    <CleanerAvailabilitySection
      v-if="activeRouteName === 'CleanerAvailability'"
      :calendarDays="calendarDays"
    />
    <CleanerServicesPricingSection
      v-if="activeRouteName === 'CleanerServicesPricing'"
      :hourlyRateLabel="hourlyRateLabel"
    />
    <CleanerFinancialsSection
      v-if="activeRouteName === 'CleanerFinancials'"
      :earningsToDate="earningsToDate"
    />
    <CleanerReviewsSection v-if="activeRouteName === 'CleanerReviews'" />
    <CleanerProfile v-if="activeRouteName === 'CleanerProfile'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { transitionBookingState } from '@/services/bookingService'
import { formatDateTime, formatStatus } from '@/utils/format'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { cleanerDashboardLinks } from '@/pages/dasboardLinks'
import CleanerDashboardSection from './components/CleanerDashboardSection.vue'
import CleanerBookingsSection from './components/CleanerBookingsSection.vue'
import CleanerAvailabilitySection from './components/CleanerAvailabilitySection.vue'
import CleanerServicesPricingSection from './components/CleanerServicesPricingSection.vue'
import CleanerFinancialsSection from './components/CleanerFinancialsSection.vue'
import CleanerReviewsSection from './components/CleanerReviewsSection.vue'
import CleanerProfile from './components/CleanerProfile.vue'
import type { BookingStatus } from '@/types/domain'

interface Booking {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: BookingStatus
  created_at: string
}

const auth = useAuthStore()
const route = useRoute()
const bookings = ref<Booking[]>([])
const loading = ref(true)
const errorMessage = ref('')
const calendarDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CleanerDashboard',
)

const hourlyRateLabel = computed(() => {
  const amount = auth.cleanerProfile?.hourly_rate_cents
  const currency = auth.cleanerProfile?.currency ?? 'GBP'
  if (amount == null || amount <= 0) return 'Not set yet'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount / 100)
})

const ratingLabel = computed(() => {
  if (!auth.cleanerProfile) return 'No rating yet'
  const { average_rating, review_count } = auth.cleanerProfile
  return `${average_rating.toFixed(1)} (${review_count} reviews)`
})

const earningsToDate = computed(() => {
  const rate = auth.cleanerProfile?.hourly_rate_cents ?? 0
  const amount = (bookingTotals.value.completed * 2 * rate) / 100
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: auth.cleanerProfile?.currency ?? 'GBP',
  }).format(amount)
})

const bookingTotals = computed(() => ({
  pending: bookings.value.filter((b) => b.status === 'pending_request').length,
  accepted: bookings.value.filter((b) =>
    ['awaiting_customer_payment', 'payment_authorized', 'in_progress'].includes(b.status),
  ).length,
  completed: bookings.value.filter((b) => b.status === 'completed').length,
}))

onMounted(loadBookings)

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.init()
    if (!auth.userId) { bookings.value = []; return }

    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .select('id, service_title_snapshot, scheduled_start, location_text, status, created_at')
      .eq('cleaner_id', auth.userId)
      .order('scheduled_start', { ascending: true })
    if (error) throw error
    bookings.value = (data ?? []) as Booking[]
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
    bookings.value = []
  } finally {
    loading.value = false
  }
}

async function acceptBooking(id: string) {
  try {
    await transitionBookingState(id, 'payment_authorized')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to accept booking.'
  }
}

async function declineBooking(id: string) {
  try {
    await transitionBookingState(id, 'cancelled')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to decline booking.'
  }
}

async function markCompleted(id: string) {
  try {
    await transitionBookingState(id, 'completed')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to mark booking completed.'
  }
}

// Exposed to child sections — uses shared format util
const formatDate = formatDateTime
</script>
