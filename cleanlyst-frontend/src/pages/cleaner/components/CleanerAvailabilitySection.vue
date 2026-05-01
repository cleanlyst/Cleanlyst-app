<template>
  <div class="section-card">
    <p class="boldFont">Availability</p>
    <p class="small">Basic calendar slots where you can set available days and times.</p>
    <div class="calendar-grid">
      <span v-for="day in calendarDays" :key="day" class="calendar-day">{{ day }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  calendarDays: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
})
</script>
