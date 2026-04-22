<template>
  <div class="row no-gutter dashboard-container">
    <section class="side-nav col-lg-2">
      <ul class="side-nav-links">
        <li>Dashboard</li>
        <li>My bookings</li>
        <li>Preferences</li>
        <li>Settings</li>
      </ul>
    </section>
    <section class="main-page col-lg-10">
      <div class="greeting-header">
        <h2 class="h4">
          {{ greetingName ? `Welcome back, ${greetingName}.` : 'Manage your bookings.' }}
        </h2>
        <router-link :to="{ name: 'BookCleaner' }" class="greenButton">Book a cleaner</router-link>
      </div>

      <div class="cleaners-container">
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

      <div class="booking-overview">
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
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import fallbackPhoto from '@/assets/landingpage.png'

interface BookingSummary {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: 'pending' | 'accepted' | 'declined' | 'paid' | 'in_progress' | 'completed' | 'cancelled'
}

const auth = useAuthStore()
const bookings = ref<BookingSummary[]>([])
const loading = ref(true)
const errorMessage = ref('')

const greetingName = computed(() => auth.profile?.full_name?.split(' ')[0] ?? '')
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

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function formatStatus(value: string) {
  return value.replace('_', ' ')
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
  color: var(--white);
  font-weight: 500;
  margin-bottom: 20px;
  cursor: pointer;
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

@media (max-width: 768px) {
}
</style>
