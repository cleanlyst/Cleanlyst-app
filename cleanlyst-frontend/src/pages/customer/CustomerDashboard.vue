<template>
  <div class="row no-gutter dashboard-container">
    <section class="side-nav col-lg-2">
      <ul class="side-nav-links hide-mobile">
        <li v-for="item in navItems" :key="item.name">
          <router-link
            :to="{ name: item.name }"
            class="nav-link"
            :class="{ active: activeRouteName === item.name }"
          >
            {{ item.label }}
          </router-link>
        </li>
      </ul>

      <ul class="side-nav-links hide-desktop">
        <li v-for="item in navItems" :key="`mobile-${item.name}`">
          <router-link
            :to="{ name: item.name }"
            class="nav-link mobile-nav-link"
            :class="{ active: activeRouteName === item.name }"
          >
            <span class="">{{ item.label }}</span>
          </router-link>
        </li>
      </ul>
    </section>
    <section class="main-page col-lg-10">
      <div class="greeting-header">
        <h2 class="h4">Manage your bookings.</h2>
        <router-link :to="{ name: 'BookCleaner' }" class="greenButton">Book a cleaner</router-link>
      </div>

      <div class="top-dash-container row no-gutter">
        <div class="col-lg-9 cleaners-near-you">
          <div
            v-if="activeRouteName === 'CustomerDashboard'"
            class="cleaners-container card-shadow"
          >
            <div class="section-title">
              <p class="boldFont no-margin">Cleaners near you</p>
              <span class="text no-margin text-underline">See all</span>
            </div>

            <div class="cleaner-card-container">
              <div
                v-for="cleaner in cleanersData"
                :key="cleaner.id"
                class="cleaner-card card-shadow"
              >
                <div class="cleaner-profile">
                  <img :src="cleaner.photo || fallbackPhoto" alt="Cleaner" class="cleaner-avatar" />
                  <div class="name-rating">
                    <p class="cleaner-name no-margin">{{ cleaner.name }}</p>
                    <p class="cleaner-rating no-margin">Rating: {{ cleaner.rating }}/5</p>
                  </div>
                </div>

                <div class="cleaner-info">
                  <p>{{ cleaner.services }}</p>
                  <p>{{ cleaner.price }}</p>
                  <p>{{ cleaner.available }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="activeRouteName === 'CustomerDashboard'"
          class="col-lg-3 messages-notifications card-shadow"
        >
          <p class="boldFont">Messages</p>
        </div>
      </div>

      <div v-if="activeRouteName === 'CustomerDashboard'" class="booking-overview">
        <div class="upcoming-booking-container card-shadow">
          <div class="section-title">
            <p class="boldFont no-margin">Upcoming Booking</p>
            <span class="text no-margin text-underline">See all</span>
          </div>

          <p v-if="!bookings.length" class="emptyState">
            You have not requested a cleaner yet. Start a booking when you're ready.
          </p>
          <div class="upcoming-card">
            <p class="no-margin">Cleaner</p>
            <p class="no-margin">Service</p>
            <p class="no-margin">Date</p>
            <p class="no-margin">Time</p>

            <div class="upcoming-CTAs">
              <button class="blueButton">View Booking</button>
              <button class="blueButton">Reschedule</button>
            </div>
          </div>
        </div>
        <div class="recent-booking-container card-shadow">
          <div class="section-title">
            <p class="boldFont no-margin">Recent Bookings</p>
            <span class="text no-margin text-underline">See all</span>
          </div>

          <p v-if="!bookings.length" class="emptyState">
            You have not requested a cleaner yet. Start a booking when you're ready.
          </p>
          <div class="recent-card">
            <div v-for="booking in recentBookings" :key="booking.id" class="recent-cleaner-card">
              <div class="recent-details">
                <p class="no-margin">{{ booking.name }}</p>
                <p class="small">{{ booking.detail }}</p>
              </div>
              <div class="rebook-button">
                <button class="blueButton">Rebook</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeRouteName === 'CustomerBookings'" class="section-card">
        <p class="boldFont">My bookings</p>
        <p class="small">Track your pending, confirmed, and completed bookings in one place.</p>
        <div class="stats-row">
          <div class="stat-tile">
            <p class="small no-margin">Pending approval</p>
            <p class="boldFont no-margin">{{ bookingTotals.pending }}</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Upcoming bookings</p>
            <p class="boldFont no-margin">{{ bookingTotals.accepted }}</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Completed</p>
            <p class="boldFont no-margin">{{ bookingTotals.completed }}</p>
          </div>
        </div>
      </div>

      <div v-if="activeRouteName === 'CustomerPreferences'" class="section-card">
        <p class="boldFont">Preferences</p>
        <p class="small">Set your preferred cleaning types, timing, and cleaner requirements.</p>
      </div>

      <div v-if="activeRouteName === 'CustomerSettings'" class="section-card">
        <p class="boldFont">Settings</p>
        <p class="small">Manage profile details, contact preferences, and account security.</p>
      </div>
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
import dashboardIcon from '@/assets/dashboard.png'
import bookingsIcon from '@/assets/bookings.png'
import preferencesIcon from '@/assets/preferences.png'
import settingsIcon from '@/assets/settings.png'

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
const navItems = [
  { name: 'CustomerDashboard', label: 'Dashboard', icon: dashboardIcon },
  { name: 'CustomerBookings', label: 'My Bookings', icon: bookingsIcon },
  { name: 'CustomerPreferences', label: 'Preferences', icon: preferencesIcon },
  { name: 'CustomerSettings', label: 'Settings', icon: settingsIcon },
]

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

<style scoped>
.dashboard-container {
  min-height: calc(100vh - 90px);
  padding: 0 12px;
}
section.side-nav.col-lg-2 {
  border-right: 1px solid var(--grey);
}
ul.side-nav-links {
  padding: 30px 8px;
  margin: 10px 9px;
  border-radius: 8px;
}
.side-nav-links li {
  margin-bottom: 20px;
}
.nav-link {
  color: var(--grey);
  font-weight: 500;
  text-decoration: none;
}
.nav-link.active {
  color: var(--black);
  text-decoration: underline;
  text-underline-offset: 6px;
}
section.main-page.col-lg-10 {
  padding: 10px;
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
.cleaner-card {
  background: var(--white);
  border-radius: 5px;
  padding: 16px 14px;
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
    padding: 4px;
  }
  section.main-page.col-lg-10 {
    padding: 3px;
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
  img.side-nav-icons {
    width: 24px;
    filter: invert(1);
  }
  ul.side-nav-links.hide-desktop {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 8px 8px;
    margin: 4px 9px;
  }
  .side-nav-links li {
    margin-bottom: 0;
  }
  .mobile-nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
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
</style>
