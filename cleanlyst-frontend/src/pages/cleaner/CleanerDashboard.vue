<template>
  <DashboardLayout :links="cleanerDashboardLinks" main-label="Cleaner dashboard">
    <CleanerDashboardSection
      v-if="activeRouteName === 'CleanerDashboard'"
      :earningsToDate="earningsToDate"
      :bookingTotals="bookingTotals"
      :ratingLabel="ratingLabel"
      :errorMessage="errorMessage"
      :loading="loading"
      :bookings="bookings"
      :isAvailable="isAvailable"
      :toggleLoading="toggleLoading"
      :toggleAvailability="toggleAvailability"
      :startBooking="startBooking"
      :markCompleted="markCompleted"
      :acceptBooking="acceptBooking"
      :declineBooking="declineBooking"
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
    />
    <CleanerFinancialsSection
      v-if="activeRouteName === 'CleanerFinancials'"
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
import { useCleanerBookings } from '@/composables/useCleanerBookings'
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

const auth = useAuthStore()
const route = useRoute()
const {
  bookings,
  loading,
  errorMessage,
  bookingTotals,
  load: loadCleanerBookingRows,
  transition,
} = useCleanerBookings()
const isAvailable = ref(true)
const toggleLoading = ref(false)
const calendarDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CleanerDashboard',
)

const ratingLabel = computed(() => {
  if (!auth.cleanerProfile) return 'No rating yet'
  const { average_rating, review_count } = auth.cleanerProfile
  return `${average_rating.toFixed(1)} (${review_count} reviews)`
})

const earningsToDate = ref('—')

onMounted(loadBookings)

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    if (!auth.initialized) await auth.init()
    if (!auth.userId) { bookings.value = []; return }

    const supabase = requireSupabase()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [, profileResult, earningsResult] = await Promise.all([
      loadCleanerBookingRows(auth.userId),
      supabase
        .from('cleaner_profiles')
        .select('is_available')
        .eq('user_id', auth.userId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('cleaner_payout_cents')
        .eq('cleaner_id', auth.userId)
        .eq('status', 'completed')
        .gte('updated_at', monthStart),
    ])

    if (!profileResult.error && profileResult.data) {
      isAvailable.value = (profileResult.data as any).is_available ?? true
    }

    const totalPence = (earningsResult.data ?? []).reduce(
      (sum: number, row: any) => sum + (row.cleaner_payout_cents ?? 0),
      0,
    )
    const currency = auth.cleanerProfile?.currency ?? 'GBP'
    earningsToDate.value = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(totalPence / 100)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
    bookings.value = []
  } finally {
    loading.value = false
  }
}

async function toggleAvailability() {
  if (!auth.userId) return
  toggleLoading.value = true
  try {
    const supabase = requireSupabase()
    const newValue = !isAvailable.value
    const { error } = await supabase
      .from('cleaner_profiles')
      .update({ is_available: newValue })
      .eq('user_id', auth.userId)
    if (error) throw error
    isAvailable.value = newValue
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to update availability.'
  } finally {
    toggleLoading.value = false
  }
}

async function acceptBooking(id: string) {
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('accept_booking', { p_booking_id: id })
    if (error) throw error
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to accept booking.'
  }
}

async function declineBooking(id: string) {
  try {
    await transition(id, 'cleaner_declined')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to decline booking.'
  }
}

async function startBooking(id: string) {
  try {
    await transition(id, 'in_progress')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to start booking.'
  }
}

async function markCompleted(id: string) {
  try {
    await transition(id, 'completion_pending_customer')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to mark booking completed.'
  }
}

const formatDate = formatDateTime
</script>
