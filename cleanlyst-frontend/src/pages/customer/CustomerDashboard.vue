<template>
  <DashboardLayout :links="customerDashboardLinks" main-label="Customer dashboard">
    <CustomerDashboardSection
      v-if="activeRouteName === 'CustomerDashboard'"
      :bookings="bookings"
      :loading="loading"
      :cancelBooking="cancelBooking"
      :confirmComplete="confirmComplete"
    />
    <CustomerBookingsSection
      v-if="activeRouteName === 'CustomerBookings'"
      :bookings="bookings"
      :bookingTotals="bookingTotals"
      :loading="loading"
      :errorMessage="errorMessage"
      :cancelBooking="cancelBooking"
      :confirmComplete="confirmComplete"
    />
    <CustomerPreferencesSection v-if="activeRouteName === 'CustomerPreferences'" />
    <CustomerSettingsSection v-if="activeRouteName === 'CustomerSettings'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCustomerBookings } from '@/composables/useCustomerBookings'
import { transitionBookingState } from '@/services/bookingService'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import CustomerDashboardSection from './components/CustomerDashboardSection.vue'
import CustomerBookingsSection from './components/CustomerBookingsSection.vue'
import CustomerPreferencesSection from './components/CustomerPreferencesSection.vue'
import CustomerSettingsSection from './components/CustomerSettingsSection.vue'

const auth = useAuthStore()
const route = useRoute()
const {
  bookings,
  loading,
  errorMessage,
  bookingTotals,
  load,
  cancel,
} = useCustomerBookings()

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CustomerDashboard',
)

onMounted(loadBookings)

async function cancelBooking(id: string) {
  try {
    await cancel(id)
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to cancel booking.'
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
  try {
    await transitionBookingState(id, 'completed')
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to confirm completion.'
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
