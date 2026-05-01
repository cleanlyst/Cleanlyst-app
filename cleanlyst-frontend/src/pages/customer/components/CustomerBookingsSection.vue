<template>
  <div class="section-card">
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
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

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
})
</script>
