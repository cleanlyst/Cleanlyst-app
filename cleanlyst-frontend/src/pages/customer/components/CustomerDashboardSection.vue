<template>
  <div>
    <div class="top-dash-container row no-gutter">
      <div class="col-lg-9 cleaners-near-you">
        <div class="cleaners-container card-shadow">
          <div class="section-title">
            <p class="boldFont no-margin">Cleaners near you</p>
            <span class="text no-margin text-underline">See all</span>
          </div>

          <div class="cleaner-card-container">
            <div
              v-for="cleaner in cleanersData"
              :key="cleaner.id"
              class="dashboard-card card-shadow"
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
      <div class="col-lg-3 messages-notifications card-shadow">
        <p class="boldFont">Messages</p>
      </div>
    </div>

    <div class="booking-overview">
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
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

interface CleanerDataItem {
  id: string
  name: string
  rating: number
  services: string
  price: string
  available: string
  photo?: string
}

interface RecentBooking {
  id: string
  name: string
  detail: string
}

interface BookingSummary {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: string
}

defineProps({
  cleanersData: {
    type: Array as PropType<CleanerDataItem[]>,
    default: () => [],
  },
  fallbackPhoto: {
    type: String,
    required: true,
  },
  bookings: {
    type: Array as PropType<BookingSummary[]>,
    default: () => [],
  },
  recentBookings: {
    type: Array as PropType<RecentBooking[]>,
    default: () => [],
  },
})
</script>
