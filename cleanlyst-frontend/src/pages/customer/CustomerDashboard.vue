<template>
  <div class="row no-gutter dashboard-container">
    <section class="side-nav col-lg-2">
      <ul class="side-nav-links hide-mobile">
        <li v-for="item in navItems" :key="item.name">
          <router-link :to="{ name: item.name }" class="nav-link" :class="{ active: activeRouteName === item.name }">
            {{ item.label }}
          </router-link>
        </li>
      </ul>

      <ul class="side-nav-links hide-desktop">
        <li v-for="item in navItems" :key="`mobile-${item.name}`">
          <router-link :to="{ name: item.name }" class="nav-link mobile-nav-link" :class="{ active: activeRouteName === item.name }">
            <img class="side-nav-icons" :src="item.icon" :alt="item.label" />
            <span class="white-text">{{ item.label }}</span>
          </router-link>
        </li>
      </ul>
    </section>
    <section class="main-page col-lg-10">
      <div class="greeting-header">
        <h2 class="h4">
          {{ greetingName ? `Welcome back, ${greetingName}.` : 'Manage your bookings.' }}
        </h2>
        <router-link :to="{ name: 'BookCleaner' }" class="greenButton">Book a cleaner</router-link>
      </div>

      <div v-if="activeRouteName === 'CustomerDashboard'" class="cleaners-container">
        <p class="boldFont">Cleaners near you</p>
        <div class="cleaner-card-container">
          <div class="cleaner-card">
            <div class="cleaner-profile">
              <img :src="fallbackPhoto" alt="Cleaner" class="cleaner-avatar" />
              <div class="name-rating">
                <p class="cleaner-name no-margin">Jane Doe</p>
                <p class="cleaner-rating no-margin">Rating: 4.8/5</p>
              </div>
            </div>

            <div class="cleaner-info">
              <p>Services</p>
              <p>Price per hour</p>
              <p>Available:</p>
            </div>
          </div>
          <div class="cleaner-card">
            <div class="cleaner-profile">
              <img :src="fallbackPhoto" alt="Cleaner" class="cleaner-avatar" />
              <div class="name-rating">
                <p class="cleaner-name no-margin">Jane Doe</p>
                <p class="cleaner-rating no-margin">Rating: 4.8/5</p>
              </div>
            </div>

            <div class="cleaner-info">
              <p>Services</p>
              <p>Price per hour</p>
              <p>Available:</p>
            </div>
          </div>
          <div class="cleaner-card">
            <div class="cleaner-profile">
              <img :src="fallbackPhoto" alt="Cleaner" class="cleaner-avatar" />
              <div class="name-rating">
                <p class="cleaner-name no-margin">Jane Doe</p>
                <p class="cleaner-rating no-margin">Rating: 4.8/5</p>
              </div>
            </div>

            <div class="cleaner-info">
              <p>Services</p>
              <p>Price per hour</p>
              <p>Available:</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeRouteName === 'CustomerDashboard'" class="booking-overview">
        <div class="upcoming-booking-container">
          <p class="boldFont">Upcoming booking</p>
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
        <div class="recent-booking-container">
          <p class="boldFont">Recent bookings</p>
          <p v-if="!bookings.length" class="emptyState">
            You have not requested a cleaner yet. Start a booking when you're ready.
          </p>
          <div class="recent-card">
            <div class="recent-cleaner-card">
              <div class="recent-details">
                <p class="no-margin">Jane Doe</p>
                <p class="small">12/Apr/26 - Home Cleaning</p>
              </div>
              <div class="rebook-button">
                <button class="blueButton">Rebook</button>
              </div>
            </div>
            <div class="recent-cleaner-card">
              <div class="recent-details">
                <p class="no-margin">Jane Doe</p>
                <p class="small">12/Apr/26 - Home Cleaning</p>
              </div>
              <div class="rebook-button">
                <button class="blueButton">Rebook</button>
              </div>
            </div>
            <div class="recent-cleaner-card">
              <div class="recent-details">
                <p class="no-margin">Jane Doe</p>
                <p class="small">12/Apr/26 - Home Cleaning</p>
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

const auth = useAuthStore()
const route = useRoute()
const bookings = ref<BookingSummary[]>([])
const loading = ref(true)
const errorMessage = ref('')
const navItems = [
  { name: 'CustomerDashboard', label: 'Dashboard', icon: dashboardIcon },
  { name: 'CustomerBookings', label: 'My Bookings', icon: bookingsIcon },
  { name: 'CustomerPreferences', label: 'Preferences', icon: preferencesIcon },
  { name: 'CustomerSettings', label: 'Settings', icon: settingsIcon },
]

const greetingName = computed(() => auth.profile?.full_name?.split(' ')[0] ?? '')
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
  padding: 12px;
}
ul.side-nav-links {
  background: var(--green);
  padding: 30px 8px;
  margin: 10px 9px;
  border-radius: 8px;
}
.side-nav-links li {
  margin-bottom: 20px;
}
.nav-link {
  color: var(--white);
  font-weight: 500;
  text-decoration: none;
}
.nav-link.active {
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
.cleaners-container {
  padding: 10px 0;
}
.cleaner-card-container {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px;
}
img.cleaner-avatar {
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
.cleaner-card {
  border: 1px solid var(--green);
  border-radius: 5px;
  padding: 12px 6px;
}
.upcoming-booking-container,
.recent-booking-container {
  border: 1px solid var(--blue);
  padding: 20px;
  border-radius: 8px;
  width: 45%;
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
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 0;
  }
  .greeting-header h2 {
    margin-bottom: 10px;
    font-size: 22px;
  }
  img.side-nav-icons {
    width: 24px;
    filter: invert(1);
  }
  ul.side-nav-links.hide-desktop {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
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
}
</style>
