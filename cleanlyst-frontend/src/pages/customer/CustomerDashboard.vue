<template>
  <DashboardLayout :links="customerDashboardLinks" main-label="Customer dashboard">
    <CustomerDashboardSection
      v-if="activeRouteName === 'CustomerDashboard'"
      :bookings="bookings"
      :loading="loading"
      :actionLoadingId="actionLoadingId"
      :cancelBooking="cancelBooking"
      :confirmComplete="confirmComplete"
      @payment-done="loadBookings"
    />
    <CustomerBookingsSection
      v-if="activeRouteName === 'CustomerBookings'"
      :bookingTotals="bookingTotals"
      :cancelBooking="cancelBooking"
      :confirmComplete="confirmComplete"
    />
    <CustomerPreferencesSection v-if="activeRouteName === 'CustomerPreferences'" />
    <CustomerSettingsSection v-if="activeRouteName === 'CustomerSettings'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RealtimeSubscription } from '@/lib/realtime'
import { toUserMessage } from '@/utils/format'
import { useRoute, useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCustomerBookings } from '@/composables/useCustomerBookings'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'
import { transitionBookingState } from '@/services/bookingService'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import { subscribeToTable, unsubscribe } from '@/lib/realtime'
import CustomerDashboardSection from './components/CustomerDashboardSection.vue'
import CustomerBookingsSection from './components/CustomerBookingsSection.vue'
import CustomerPreferencesSection from './components/CustomerPreferencesSection.vue'
import CustomerSettingsSection from './components/CustomerSettingsSection.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const prefsStore = useCustomerPreferencesStore()
const { bookings, loading, errorMessage, bookingTotals, load, cancel } = useCustomerBookings()
const actionLoadingId = ref<string | null>(null)
const realtimeChannel = ref<RealtimeSubscription | null>(null)

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CustomerDashboard',
)

onMounted(async () => {
  // Guard: redirect to onboarding if started but not finished setup.
  // Brand-new customers with no preferences record bypass this guard so they
  // land directly on the dashboard (the booking wizard collects their address).
  await prefsStore.load()
  if (prefsStore.preferences && !prefsStore.preferences.setup_completed_at) {
    await router.replace({ name: 'CustomerOnboarding' })
    return
  }

  await loadBookings()
  if (auth.userId && !realtimeChannel.value) {
    realtimeChannel.value = subscribeToTable('customer-dashboard-bookings', {
      table: 'bookings',
      filter: `customer_id=eq.${auth.userId}`,
      onData: () => loadBookings(),
    })
  }
})

onBeforeUnmount(() => unsubscribe(realtimeChannel.value))

async function cancelBooking(id: string) {
  actionLoadingId.value = id
  try {
    await cancel(id)
    await loadBookings()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to cancel booking. Please try again.')
  } finally {
    actionLoadingId.value = null
  }
}

async function loadBookings() {
  if (!auth.initialized) await auth.init()
  if (!auth.userId) {
    bookings.value = []
    return
  }
  await load(auth.userId, resolveCleanerNames)
}

async function confirmComplete(id: string) {
  actionLoadingId.value = id
  try {
    await transitionBookingState(id, 'completed')
    await loadBookings()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to confirm completion. Please try again.')
  } finally {
    actionLoadingId.value = null
  }
}

async function resolveCleanerNames(cleanerIds: string[]) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', cleanerIds)
  if (error) throw error
  return new Map((data ?? []).map((profile) => [profile.id, profile.full_name ?? '']))
}
</script>
