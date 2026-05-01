<template>
  <div class="section-card">
    <p class="boldFont">Services & Pricing</p>
    <p class="small">Edit the services you provide and adjust your pricing.</p>
    <p class="boldFont no-margin">{{ hourlyRateLabel }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps({
  hourlyRateLabel: {
    type: String,
    required: true,
  },
})
</script>
