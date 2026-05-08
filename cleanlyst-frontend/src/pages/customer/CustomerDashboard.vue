<template>
  <div class="dashboard-layout dashboard-container">
    <DashboardSideBar :links="customerDashboardLinks" />
    <section class="main-page">
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
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import cleanerData from '@/data/cleanerData.json'
import fallbackPhoto from '@/assets/landingpage.png'
import DashboardSideBar from '../../components/DashboardSideBar.vue'
import { customerDashboardLinks } from '../dasboardLinks'
import CustomerDashboardSection from './components/CustomerDashboardSection.vue'
import CustomerBookingsSection from './components/CustomerBookingsSection.vue'
import CustomerPreferencesSection from './components/CustomerPreferencesSection.vue'
import CustomerSettingsSection from './components/CustomerSettingsSection.vue'

interface BookingSummary {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: 'pending' | 'accepted' | 'declined' | 'paid' | 'in_progress' | 'completed' | 'cancelled'
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
  pending: bookings.value.filter((booking) => booking.status === 'pending').length,
  accepted: bookings.value.filter((booking) =>
    ['accepted', 'paid', 'in_progress'].includes(booking.status),
  ).length,
  completed: bookings.value.filter((booking) => booking.status === 'completed').length,
}))

onMounted(async () => {
  await loadBookings()
})

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
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to cancel booking.'
  }
}

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''

  try {
    await auth.init()

    if (!auth.userId) {
      bookings.value = []
      return
    }

    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .select('id, service_title_snapshot, location_text, scheduled_start, status')
      .eq('customer_id', auth.userId)
      .order('scheduled_start', { ascending: true })

    if (error) throw error

    bookings.value = (data ?? []) as BookingSummary[]
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load bookings.'
    bookings.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style>
.dashboard-container {
  min-height: calc(100vh - 90px);
}

.dashboard-layout {
  display: flex;
  flex-direction: column;
}

section.main-page {
  width: 100%;
  max-width: 100%;
  padding: 1rem;
}
.greeting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid grey;
}
.top-dash-container.row.no-gutter {
  margin: 10px 0;
}
.cleaners-near-you {
  padding: 0 10px;
}
.cleaners-container,
.messages-notifications {
  padding: 10px;
}
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.cleaner-card-container {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px;
}

.cleaner-profile {
  display: flex;
  align-items: center;
}
.cleaner-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 10px;
}

.booking-overview {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 12px 0;
}
.upcoming-booking-container,
.recent-booking-container {
  padding: 20px;
  width: 50%;
  margin: 0 6px;
}
.upcoming-card {
  margin-top: 12px;
}
.upcoming-CTAs {
  border-top: 2px solid grey;
  margin: 5px 0;
  padding: 10px 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.upcoming-CTAs button {
  width: 45%;
}
.recent-card {
  margin-top: 16px;
}
.recent-cleaner-card {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.section-card {
  border: 1px solid var(--blue);
  border-radius: 8px;
  padding: 20px;
  margin-top: 14px;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.stat-tile {
  border: 1px solid var(--green);
  border-radius: 6px;
  padding: 12px;
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 0;
  }
  section.main-page {
    padding: 0.75rem;
  }
  .upcoming-booking-container,
  .recent-booking-container {
    width: 100%;
    margin: 10px 0;
  }
  .booking-overview {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin: 12px 0;
  }
  .greeting-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 10px 0;
  }
  .greeting-header h2 {
    font-size: 22px;
  }
  .cleaners-near-you {
    padding: 0;
    margin-bottom: 10px;
  }
  .stats-row {
    grid-template-columns: 1fr;
  }
  .cleaner-card-container {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
  }
}

@media (min-width: 768px) {
  .dashboard-layout {
    flex-direction: row;
  }

  section.main-page {
    width: calc(100% - 16rem);
    padding: 1.5rem;
  }
}
</style>
