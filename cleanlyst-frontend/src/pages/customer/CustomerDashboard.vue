<template>
  <DashboardLayout :links="customerDashboardLinks" main-label="Customer dashboard">
    <CustomerDashboardSection
      v-if="activeRouteName === 'CustomerDashboard'"
      :bookings="bookings"
      :loading="loading"
      :cancelBooking="cancelBooking"
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
import { transitionBookingState } from '@/services/bookingService'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import CustomerDashboardSection from './components/CustomerDashboardSection.vue'
import type { BookingWithCleaner } from './components/CustomerDashboardSection.vue'
import CustomerBookingsSection from './components/CustomerBookingsSection.vue'
import CustomerPreferencesSection from './components/CustomerPreferencesSection.vue'
import CustomerSettingsSection from './components/CustomerSettingsSection.vue'

const auth = useAuthStore()
const route = useRoute()
const bookings = ref<BookingWithCleaner[]>([])
const loading = ref(true)
const errorMessage = ref('')

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CustomerDashboard',
)

const UPCOMING_STATUSES = [
  'pending_request',
  'estimate_proposed',
  'awaiting_customer_payment',
  'payment_authorized',
  'in_progress',
  'completion_pending_customer',
]

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
    await transitionBookingState(id, 'cancelled')
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
      .select(`
        id,
        service_title_snapshot,
        location_text,
        scheduled_start,
        status,
        quote_cents,
        cleaner_id,
        cleaner_profiles!bookings_cleaner_id_fkey (
          profiles!cleaner_profiles_user_id_fkey (
            full_name
          )
        )
      `)
      .eq('customer_id', auth.userId)
      .order('scheduled_start', { ascending: true })

    if (error) throw error

    bookings.value = (data ?? []).map((row: any) => ({
      id: row.id,
      service_title_snapshot: row.service_title_snapshot ?? null,
      location_text: row.location_text ?? '',
      scheduled_start: row.scheduled_start ?? '',
      status: row.status ?? '',
      quote_cents: row.quote_cents ?? null,
      cleaner_id: row.cleaner_id ?? null,
      cleaner_name: row.cleaner_profiles?.profiles?.full_name ?? null,
    })) as BookingWithCleaner[]
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
    bookings.value = []
  } finally {
    loading.value = false
  }
}
</script>
