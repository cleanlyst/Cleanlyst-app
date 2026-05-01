<template>
  <div class="section-card">
    <p class="boldFont">Financials</p>
    <p class="small">Earnings to date with month filter options.</p>
    <p class="boldFont no-margin">{{ earningsToDate }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps({
  earningsToDate: {
    type: String,
    required: true,
  },
})
</script>
