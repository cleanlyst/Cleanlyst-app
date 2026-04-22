<template>
  <main class="dashboardPage">
    <section class="dashboardHero">
      <div>
        <p class="eyebrow">Customer dashboard</p>
        <h1>{{ greetingName ? `Welcome back, ${greetingName}.` : 'Manage your bookings.' }}</h1>
        <p>
          Review your latest requests, jump into a fresh booking, and keep track of completed
          jobs in one place.
        </p>
      </div>

      <div class="heroActions">
        <router-link :to="{ name: 'BookCleaner' }" class="greenButton">Book a cleaner</router-link>
      </div>
    </section>

    <section class="statsGrid">
      <article class="statCard">
        <span>Pending</span>
        <strong>{{ bookingTotals.pending }}</strong>
      </article>
      <article class="statCard">
        <span>Accepted</span>
        <strong>{{ bookingTotals.accepted }}</strong>
      </article>
      <article class="statCard">
        <span>Completed</span>
        <strong>{{ bookingTotals.completed }}</strong>
      </article>
    </section>

    <section class="contentGrid">
      <article class="panel">
        <div class="panelHeader">
          <div>
            <p class="panelEyebrow">Recent bookings</p>
            <h2>Your activity</h2>
          </div>
        </div>

        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <p v-else-if="loading" class="emptyState">Loading your bookings...</p>
        <p v-else-if="!bookings.length" class="emptyState">
          You have not requested a cleaner yet. Start a booking when you're ready.
        </p>

        <div v-else class="bookingList">
          <article v-for="booking in bookings" :key="booking.id" class="bookingCard">
            <div>
              <p class="bookingTitle">{{ booking.service_title_snapshot }}</p>
              <p class="bookingMeta">{{ formatDate(booking.scheduled_start) }}</p>
            </div>
            <div class="bookingAside">
              <span class="statusPill" :class="booking.status">{{ formatStatus(booking.status) }}</span>
              <p>{{ booking.location_text }}</p>
            </div>
          </article>
        </div>
      </article>

      <article class="panel tipsPanel">
        <p class="panelEyebrow">Next steps</p>
        <h2>Keep your requests moving</h2>
        <ul class="tipsList">
          <li>Add full address details and arrival notes for smoother handoffs.</li>
          <li>Use the booking form to compare services and request a new visit quickly.</li>
          <li>After a completed clean, leave a review to help surface trusted cleaners.</li>
        </ul>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

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
.dashboardPage {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.dashboardHero,
.panel,
.statCard {
  border-radius: 28px;
  border: 1px solid rgba(16, 35, 61, 0.08);
  box-shadow: 0 24px 60px rgba(16, 35, 61, 0.08);
}

.dashboardHero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 1.5rem;
  padding: 2rem;
  color: #f7f2e9;
  background: linear-gradient(135deg, #10233d 0%, #1e4365 100%);
}

.eyebrow,
.panelEyebrow {
  margin: 0 0 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.82rem;
}

.eyebrow {
  color: rgba(247, 242, 233, 0.72);
}

.panelEyebrow {
  color: rgba(16, 35, 61, 0.52);
}

h1,
h2 {
  margin: 0;
  color: #10233d;
}

.dashboardHero h1,
.dashboardHero p {
  color: #f7f2e9;
}

.heroActions {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.statsGrid,
.contentGrid {
  display: grid;
  gap: 1.25rem;
  margin-top: 1.25rem;
}

.statsGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.contentGrid {
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
}

.statCard,
.panel {
  padding: 1.5rem;
  background: rgba(255, 252, 246, 0.94);
}

.statCard span {
  display: block;
  color: rgba(16, 35, 61, 0.58);
  margin-bottom: 0.5rem;
}

.statCard strong {
  font-size: 2rem;
  color: #10233d;
}

.panelHeader {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.bookingList {
  display: grid;
  gap: 0.9rem;
  margin-top: 1.25rem;
}

.bookingCard {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem 1.1rem;
  border-radius: 20px;
  background: #f7f2e9;
}

.bookingTitle {
  margin: 0;
  font-weight: 700;
  color: #10233d;
}

.bookingMeta,
.bookingAside p {
  margin: 0.25rem 0 0;
  color: #425168;
}

.bookingAside {
  text-align: right;
}

.statusPill {
  display: inline-flex;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  text-transform: capitalize;
  font-size: 0.85rem;
  font-weight: 700;
}

.statusPill.pending {
  background: rgba(230, 117, 71, 0.14);
  color: #b65c2d;
}

.statusPill.accepted,
.statusPill.paid,
.statusPill.in_progress {
  background: rgba(64, 138, 113, 0.14);
  color: #1f5f4d;
}

.statusPill.completed {
  background: rgba(11, 45, 114, 0.12);
  color: #0b2d72;
}

.statusPill.declined,
.statusPill.cancelled {
  background: rgba(222, 82, 70, 0.12);
  color: #8f2d23;
}

.tipsPanel {
  background: linear-gradient(180deg, rgba(231, 237, 246, 0.92), rgba(255, 252, 246, 0.96));
}

.tipsList {
  margin: 1.25rem 0 0;
  padding-left: 1.2rem;
  color: #425168;
}

.emptyState,
.message {
  margin-top: 1rem;
}

.message.error {
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: rgba(222, 82, 70, 0.12);
  color: #8f2d23;
}

@media (max-width: 900px) {
  .dashboardHero,
  .statsGrid,
  .contentGrid {
    grid-template-columns: 1fr;
  }

  .heroActions {
    justify-content: flex-start;
  }

  .bookingCard {
    flex-direction: column;
  }

  .bookingAside {
    text-align: left;
  }
}
</style>
