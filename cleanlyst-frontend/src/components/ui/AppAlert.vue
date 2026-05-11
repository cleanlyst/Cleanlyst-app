<template>
  <div
    v-if="visible"
    :class="['flex items-start gap-3 px-4 py-3 rounded border text-sm', colorClass]"
    role="alert"
    :aria-live="type === 'error' ? 'assertive' : 'polite'"
  >
    <span class="material-symbols-outlined text-base shrink-0 mt-0.5" aria-hidden="true">
      {{ iconName }}
    </span>
    <div class="flex-1 min-w-0">
      <p v-if="title" class="font-medium">{{ title }}</p>
      <p :class="{ 'mt-0.5': title }">
        <slot>{{ message }}</slot>
      </p>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="material-symbols-outlined text-base shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      aria-label="Dismiss"
      @click="dismiss"
    >close</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export type AlertType = 'success' | 'error' | 'warning' | 'info'

const props = withDefaults(
  defineProps<{
    type?: AlertType
    title?: string
    message?: string
    dismissible?: boolean
  }>(),
  { type: 'info', dismissible: false },
)

const emit = defineEmits<{ dismiss: [] }>()

const visible = ref(true)

watch(
  () => props.message,
  () => { visible.value = true },
)

function dismiss() {
  visible.value = false
  emit('dismiss')
}

const colorClass: Record<AlertType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-error-container border-error text-on-error-container',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}[props.type]

const iconName: Record<AlertType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
}[props.type]
</script>
