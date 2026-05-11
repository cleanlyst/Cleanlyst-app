<template>
  <DashboardLayout :links="customerDashboardLinks" main-label="Customer dashboard">
    <CustomerDashboardSection
      v-if="activeRouteName === 'CustomerDashboard'"
      :cleanersData="cleanersData"
      :fallbackPhoto="fallbackPhoto"
      :bookings="bookings"
      :recentBookings="recentBookings"
    />
    <CustomerBookingsSection
      v-if="activeRouteName === 'CustomerBookings'"
      :bookings="bookings"
      :bookingTotals="bookingTotals"
      :loading="loading"
      :errorMessage="errorMessage"
      :cancelBooking="cancelBooking"
    />
    <CustomerPreferencesSection v-if="activeRouteName === 'CustomerPreferences'" />
    <CustomerSettingsSection v-if="activeRouteName === 'CustomerSettings'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import cleanerData from '@/data/cleanerData.json'
import fallbackPhoto from '@/assets/landingpage.png'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import CustomerDashboardSection from './components/CustomerDashboardSection.vue'
import CustomerBookingsSection from './components/CustomerBookingsSection.vue'
import CustomerPreferencesSection from './components/CustomerPreferencesSection.vue'
import CustomerSettingsSection from './components/CustomerSettingsSection.vue'
import type { BookingStatus } from '@/types/domain'

interface BookingSummary {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: BookingStatus
}

interface CleanerDataItem {
  id: string
  name: string
  rating: number
  services: string
  price: string
  available: string
  photo?: string
}

interface CleanerDataJson {
  cleanersData: CleanerDataItem[]
  recentBookings: Array<{ id: string; name: string; detail: string }>
}

const auth = useAuthStore()
const route = useRoute()
const bookings = ref<BookingSummary[]>([])
const loading = ref(true)
const errorMessage = ref('')
const cleanersData = (cleanerData as CleanerDataJson).cleanersData
const recentBookings = (cleanerData as CleanerDataJson).recentBookings

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CustomerDashboard',
)

const bookingTotals = computed(() => ({
  pending: bookings.value.filter((b) => b.status === 'pending_request').length,
  accepted: bookings.value.filter((b) =>
    ['awaiting_customer_payment', 'payment_authorized', 'in_progress'].includes(b.status),
  ).length,
  completed: bookings.value.filter((b) => b.status === 'completed').length,
}))

onMounted(loadBookings)

async function cancelBooking(id: string) {
  try {
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('customer_id', auth.userId)
    if (error) throw error
    await loadBookings()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to cancel booking.'
  }
}

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.init()
    if (!auth.userId) { bookings.value = []; return }

    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .select('id, service_title_snapshot, location_text, scheduled_start, status')
      .eq('customer_id', auth.userId)
      .order('scheduled_start', { ascending: true })
    if (error) throw error
    bookings.value = (data ?? []) as BookingSummary[]
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
    bookings.value = []
  } finally {
    loading.value = false
  }
}
</script>
