<template>
  <div class="skeleton-wrapper" :aria-label="label" role="status">
    <slot>
      <!-- Default: stack of text-line skeletons -->
      <div
        v-for="i in lines"
        :key="i"
        class="skeleton-line"
        :style="{ width: lineWidths[i - 1] ?? '100%' }"
      />
    </slot>
    <span class="sr-only">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    lines?: number
    label?: string
  }>(),
  { lines: 3, label: 'Loading…' },
)

// Vary widths so the skeleton looks natural, not robotic
const lineWidths = ['100%', '85%', '70%', '90%', '60%']
</script>

<style scoped>
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line {
  height: 0.875rem;
  border-radius: 0.25rem;
  background: linear-gradient(
    90deg,
    #e2e8f0 25%,
    #f1f5f9 50%,
    #e2e8f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
    background: #e2e8f0;
  }
}
</style>
