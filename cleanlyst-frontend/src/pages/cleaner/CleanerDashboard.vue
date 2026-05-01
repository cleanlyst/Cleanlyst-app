<template>
  <div class="row no-gutter dashboard-container">
    <section class="side-nav col-lg-2">
      <ul class="side-nav-links">
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
    </section>
    <section class="main-page col-lg-10">
      <div class="greeting-header">
        <h2 class="h4">
          {{ greetingName ? `Welcome back, ${greetingName}.` : 'Manage your work.' }}
        </h2>
      </div>

      <div v-if="activeRouteName === 'CleanerDashboard'" class="section-card">
        <p class="boldFont">Dashboard</p>
        <div class="stats-row">
          <div class="stat-tile">
            <p class="small no-margin">Total earnings to date</p>
            <p class="boldFont no-margin">{{ earningsToDate }}</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Pending bookings</p>
            <p class="boldFont no-margin">{{ bookingTotals.accepted }}</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Rating</p>
            <p class="boldFont no-margin">{{ ratingLabel }}</p>
          </div>
        </div>
        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <div class="split-grid">
          <div class="tile">
            <p class="boldFont">Incoming requests</p>
            <p class="small">Pending approvals: {{ bookingTotals.pending }}</p>
          </div>
          <div class="tile">
            <p class="boldFont">Upcoming requests</p>
            <p class="small">Approved/pending attendance: {{ bookingTotals.accepted }}</p>
          </div>
        </div>
      </div>

      <div v-if="activeRouteName === 'CleanerBookings'" class="section-card">
        <p class="boldFont">Bookings</p>
        <p class="small">Incoming, pending attendance, and past bookings.</p>
        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <div class="stats-row">
          <div class="stat-tile">
            <p class="small no-margin">Incoming</p>
            <p class="boldFont no-margin">{{ bookingTotals.pending }}</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Pending attendance</p>
            <p class="boldFont no-margin">{{ bookingTotals.accepted }}</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Past</p>
            <p class="boldFont no-margin">{{ bookingTotals.completed }}</p>
          </div>
        </div>

        <p v-if="loading" class="small">Loading bookings...</p>
        <div v-else-if="bookings.length === 0" class="empty-state">
          <p class="small no-margin">No bookings assigned yet.</p>
        </div>
        <div v-else class="booking-list">
          <article v-for="booking in bookings" :key="booking.id" class="booking-card">
            <div>
              <p class="boldFont no-margin">
                {{ booking.service_title_snapshot ?? 'Cleaning booking' }}
              </p>
              <p class="small no-margin">{{ formatDate(booking.scheduled_start) }}</p>
              <p class="small no-margin">{{ booking.location_text }}</p>
            </div>
            <div class="booking-actions">
              <span class="status-pill">{{ formatStatus(booking.status) }}</span>
              <button
                v-if="booking.status === 'pending_request'"
                type="button"
                class="greenButton action-button"
                @click="acceptBooking(booking.id)"
              >
                Accept
              </button>
              <button
                v-if="booking.status === 'pending_request'"
                type="button"
                class="blueButton action-button"
                @click="declineBooking(booking.id)"
              >
                Decline
              </button>
            </div>
          </article>
        </div>
      </div>

      <div v-if="activeRouteName === 'CleanerAvailability'" class="section-card">
        <p class="boldFont">Availability</p>
        <p class="small">Basic calendar slots where you can set available days and times.</p>
        <div class="calendar-grid">
          <span v-for="day in calendarDays" :key="day" class="calendar-day">{{ day }}</span>
        </div>
      </div>

      <div v-if="activeRouteName === 'CleanerServicesPricing'" class="section-card">
        <p class="boldFont">Services & Pricing</p>
        <p class="small">Edit the services you provide and adjust your pricing.</p>
        <p class="boldFont no-margin">{{ hourlyRateLabel }}</p>
      </div>

      <div v-if="activeRouteName === 'CleanerFinancials'" class="section-card">
        <p class="boldFont">Financials</p>
        <p class="small">Earnings to date with month filter options.</p>
        <p class="boldFont no-margin">{{ earningsToDate }}</p>
      </div>

      <div v-if="activeRouteName === 'CleanerReviews'" class="section-card">
        <p class="boldFont">Reviews</p>
        <p class="small">Customer feedback and ratings left for your completed bookings.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { transitionBookingState } from '@/services/bookingService'
import type { BookingStatus } from '@/types/domain'

interface Booking {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: BookingStatus
  created_at: string
}

const auth = useAuthStore()
const route = useRoute()
const bookings = ref<Booking[]>([])
const loading = ref(true)
const errorMessage = ref('')
const navItems = [
  { name: 'CleanerDashboard', label: 'Dashboard' },
  { name: 'CleanerBookings', label: 'Bookings' },
  { name: 'CleanerAvailability', label: 'Availability' },
  { name: 'CleanerServicesPricing', label: 'Services & Pricing' },
  { name: 'CleanerFinancials', label: 'Financials' },
  { name: 'CleanerReviews', label: 'Reviews' },
]
const calendarDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const greetingName = computed(() => auth.profile?.full_name?.split(' ')[0] ?? '')
const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'CleanerDashboard',
)
const hourlyRateLabel = computed(() => {
  const amount = auth.cleanerProfile?.hourly_rate_cents
  const currency = auth.cleanerProfile?.currency ?? 'GBP'

  if (amount == null || amount <= 0) return 'Not set yet'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount / 100)
})
const ratingLabel = computed(() => {
  if (!auth.cleanerProfile) return 'No rating yet'

  return `${auth.cleanerProfile.average_rating.toFixed(1)} (${auth.cleanerProfile.review_count} reviews)`
})
const earningsToDate = computed(() => {
  const rate = auth.cleanerProfile?.hourly_rate_cents ?? 0
  const estimatedHoursPerCompletedBooking = 2
  const amount = (bookingTotals.value.completed * estimatedHoursPerCompletedBooking * rate) / 100
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: auth.cleanerProfile?.currency ?? 'GBP',
  }).format(amount)
})
const bookingTotals = computed(() => ({
  pending: bookings.value.filter((booking) => booking.status === 'pending_request').length,
  accepted: bookings.value.filter((booking) =>
    [
      'estimate_proposed',
      'awaiting_customer_payment',
      'payment_authorized',
      'in_progress',
      'completion_pending_customer',
    ].includes(booking.status),
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
      .select('id, service_title_snapshot, scheduled_start, location_text, status, created_at')
      .eq('cleaner_id', auth.userId)
      .order('scheduled_start', { ascending: true })

    if (error) throw error

    bookings.value = (data ?? []) as Booking[]
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load bookings.'
    bookings.value = []
  } finally {
    loading.value = false
  }
}

async function acceptBooking(id: string) {
  try {
    await transitionBookingState(id, 'estimate_proposed')
    await loadBookings()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to accept booking.'
  }
}

async function declineBooking(id: string) {
  try {
    await transitionBookingState(id, 'cleaner_declined')
    await loadBookings()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to decline booking.'
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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
  text-decoration: none;
  font-weight: 500;
}
.nav-link.active {
  text-decoration: underline;
  text-underline-offset: 6px;
}
section.main-page.col-lg-10 {
  padding: 10px;
}
.greeting-header {
  border-bottom: 1px solid grey;
  margin-bottom: 12px;
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
.split-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.tile {
  border: 1px solid var(--green);
  border-radius: 6px;
  padding: 12px;
}
.booking-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.booking-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--green);
  border-radius: 6px;
  padding: 12px;
}
.booking-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.status-pill {
  border: 1px solid var(--blue);
  border-radius: 999px;
  padding: 6px 10px;
  color: var(--blue);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}
.action-button {
  min-height: 36px;
  padding: 6px 14px;
}
.empty-state {
  border: 1px dashed var(--green);
  border-radius: 6px;
  margin-top: 16px;
  padding: 14px;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.calendar-day {
  border: 1px solid var(--green);
  border-radius: 6px;
  text-align: center;
  padding: 10px 0;
}
@media (max-width: 768px) {
  .dashboard-container {
    padding: 4px;
  }
  .stats-row,
  .split-grid,
  .calendar-grid {
    grid-template-columns: 1fr;
  }
  .booking-card {
    flex-direction: column;
  }
  .booking-actions {
    justify-content: flex-start;
  }
}
</style>
