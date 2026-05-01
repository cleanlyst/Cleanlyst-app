<template>
  <div class="section-card">
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
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

interface BookingEntry {
  id: string
  service_title_snapshot: string | null
  scheduled_start: string
  location_text: string
  status: string
}

interface BookingTotals {
  pending: number
  accepted: number
  completed: number
}

defineProps({
  bookingTotals: {
    type: Object as PropType<BookingTotals>,
    required: true,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  bookings: {
    type: Array as PropType<BookingEntry[]>,
    default: () => [],
  },
  acceptBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    required: true,
  },
  declineBooking: {
    type: Function as PropType<(id: string) => Promise<void>>,
    required: true,
  },
  formatDate: {
    type: Function as PropType<(value: string) => string>,
    required: true,
  },
  formatStatus: {
    type: Function as PropType<(value: string) => string>,
    required: true,
  },
})
</script>
