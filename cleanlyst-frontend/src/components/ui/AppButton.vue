<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[baseClass, variantClass, sizeClass]"
    v-bind="$attrs"
  >
    <AppSpinner v-if="loading" :size="spinnerSize" class="shrink-0" />
    <span
      v-if="iconLeft && !loading"
      class="material-symbols-outlined shrink-0 leading-none"
      aria-hidden="true"
    >{{ iconLeft }}</span>
    <span v-if="$slots.default" :class="{ 'sr-only': iconOnly }">
      <slot />
    </span>
    <span
      v-if="iconRight && !loading"
      class="material-symbols-outlined shrink-0 leading-none"
      aria-hidden="true"
    >{{ iconRight }}</span>
  </button>
</template>

<script setup lang="ts">
import AppSpinner from './AppSpinner.vue'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    iconLeft?: string
    iconRight?: string
    iconOnly?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    iconOnly: false,
  },
)

const baseClass =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none'

const variantClass = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-container focus-visible:ring-primary',
  secondary:
    'bg-surface-container text-on-surface hover:bg-surface-container-high focus-visible:ring-outline border border-outline-variant',
  outline:
    'border border-outline-variant bg-transparent text-on-surface hover:bg-surface-container focus-visible:ring-outline',
  ghost: 'bg-transparent text-on-surface hover:bg-surface-container focus-visible:ring-outline',
  danger:
    'bg-error text-on-error hover:opacity-90 focus-visible:ring-error',
}[props.variant]

const sizeClass = {
  sm: 'h-8 px-3 text-sm rounded',
  md: 'h-10 px-4 text-sm rounded',
  lg: 'h-12 px-6 text-base rounded',
}[props.size]

const spinnerSize = {
  sm: 'xs' as const,
  md: 'sm' as const,
  lg: 'md' as const,
}[props.size]
</script>
