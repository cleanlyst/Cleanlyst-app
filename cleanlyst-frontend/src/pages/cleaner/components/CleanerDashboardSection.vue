<template>
  <div class="section-card">
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
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

interface BookingTotals {
  pending: number
  accepted: number
  completed: number
}

defineProps({
  earningsToDate: {
    type: String,
    required: true,
  },
  bookingTotals: {
    type: Object as PropType<BookingTotals>,
    required: true,
  },
  ratingLabel: {
    type: String,
    required: true,
  },
  errorMessage: {
    type: String,
    default: '',
  },
})
</script>
