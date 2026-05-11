<template>
  <span :class="['inline-block rounded-full border-2 animate-spin', sizeClass, colorClass]" role="status">
    <span class="sr-only">Loading…</span>
  </span>
</template>

<script setup lang="ts">
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    size?: SpinnerSize
    /** Tailwind border-color utility for the spinning arc */
    color?: string
  }>(),
  { size: 'md' },
)

const sizeClass = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}[props.size]

const colorClass = props.color ?? 'border-outline-variant border-t-on-surface'
</script>
