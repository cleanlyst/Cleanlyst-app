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
      :actionLoadingId="actionLoadingId"
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
      :acceptBooking="acceptBooking"
      :declineBooking="declineBooking"
      :startBooking="startBooking"
      :markCompleted="markCompleted"
    />
    <CleanerAvailabilitySection
      v-if="activeRouteName === 'CleanerAvailability'"
      :calendarDays="calendarDays"
    />
    <CleanerServicesPricingSection v-if="activeRouteName === 'CleanerServicesPricing'" />
    <CleanerFinancialsSection v-if="activeRouteName === 'CleanerFinancials'" />
    <CleanerReviewsSection v-if="activeRouteName === 'CleanerReviews'" />
    <CleanerProfile v-if="activeRouteName === 'CleanerProfile'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RealtimeSubscription } from '@/lib/realtime'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCleanerBookings } from '@/composables/useCleanerBookings'
import { completeBooking, startBooking as startBookingRequest } from '@/services/bookingService'
import { upsertAvailabilityOverride } from '@/services/availabilityService'
import { subscribeToTable, unsubscribe } from '@/lib/realtime'
import { toUserMessage } from '@/utils/format'
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
const actionLoadingId = ref<string | null>(null)
const realtimeChannel = ref<RealtimeSubscription | null>(null)
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

onMounted(async () => {
  await loadBookings()
  if (auth.userId && !realtimeChannel.value) {
    realtimeChannel.value = subscribeToTable('cleaner-dashboard-bookings', {
      table: 'bookings',
      filter: `cleaner_id=eq.${auth.userId}`,
      onData: () => loadBookings(),
    })
  }
})

onBeforeUnmount(() => unsubscribe(realtimeChannel.value))

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    if (!auth.initialized) await auth.init()
    if (!auth.userId) {
      bookings.value = []
      return
    }

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
      isAvailable.value = profileResult.data.is_available ?? true
    }

    const earningsRows = (earningsResult.data ?? []) as Array<{
      cleaner_payout_cents: number | null
    }>
    const totalPence = earningsRows.reduce((sum, row) => sum + (row.cleaner_payout_cents ?? 0), 0)
    const currency = auth.cleanerProfile?.currency ?? 'GBP'
    earningsToDate.value = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
      totalPence / 100,
    )
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to load bookings. Please refresh.')
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
    errorMessage.value = toUserMessage(e, 'Failed to update availability. Please try again.')
  } finally {
    toggleLoading.value = false
  }
}

async function acceptBooking(id: string) {
  actionLoadingId.value = id
  try {
    await transition(id, 'accepted')

    // Block the cleaner's calendar for the booking date so they won't appear
    // in customer searches during that day. Non-fatal — acceptance already succeeded.
    const booking = bookings.value.find((b) => b.id === id)
    if (booking?.scheduled_start && auth.userId) {
      const bookingDate = booking.scheduled_start.slice(0, 10)
      await upsertAvailabilityOverride(auth.userId, bookingDate, false, 'Booking accepted').catch(
        () => {
          // Override is a best-effort block; do not surface this to the cleaner
        },
      )
    }

    await loadBookings()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to accept booking. Please try again.')
  } finally {
    actionLoadingId.value = null
  }
}

async function declineBooking(id: string) {
  actionLoadingId.value = id
  try {
    await transition(id, 'declined')
    await loadBookings()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to decline booking. Please try again.')
  } finally {
    actionLoadingId.value = null
  }
}

async function startBooking(id: string) {
  actionLoadingId.value = id
  try {
    await startBookingRequest(id)
    await loadBookings()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to start booking. Please try again.')
  } finally {
    actionLoadingId.value = null
  }
}

async function markCompleted(id: string) {
  actionLoadingId.value = id
  try {
    await completeBooking(id)
    await loadBookings()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Cannot complete job. Please try again.')
  } finally {
    actionLoadingId.value = null
  }
}

</script>
