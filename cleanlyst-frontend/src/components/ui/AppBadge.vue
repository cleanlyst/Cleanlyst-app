<template>
  <span :class="['inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', colorClass]">
    <span
      v-if="dot"
      class="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<script setup lang="ts">
export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'pending'
  | 'active'
  | 'inactive'

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant
    dot?: boolean
  }>(),
  { variant: 'default', dot: false },
)

const colorClass: Record<BadgeVariant, string> = {
  default: 'bg-surface-container-high text-on-surface',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-surface-container-high text-on-surface-variant',
}[props.variant]
</script>
