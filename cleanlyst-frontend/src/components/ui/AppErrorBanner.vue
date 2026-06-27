<template>
  <div
    v-if="message"
    role="alert"
    class="error-banner"
  >
    <span class="material-symbols-outlined error-banner__icon" aria-hidden="true">error_outline</span>
    <div class="error-banner__body">
      <p class="error-banner__message">{{ message }}</p>
      <p v-if="hint" class="error-banner__hint">{{ hint }}</p>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="error-banner__dismiss"
      aria-label="Dismiss"
      @click="emit('dismiss')"
    >
      <span class="material-symbols-outlined" style="font-size: 1rem;">close</span>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string | null
    hint?: string
    dismissible?: boolean
  }>(),
  { dismissible: false },
)

const emit = defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.25rem;
  color: #7f1d1d;
}

.error-banner__icon {
  flex-shrink: 0;
  font-size: 1.125rem;
  color: #dc2626;
  margin-top: 0.0625rem;
}

.error-banner__body {
  flex: 1;
  min-width: 0;
}

.error-banner__message {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
}

.error-banner__hint {
  font-size: 0.8125rem;
  margin-top: 0.25rem;
  opacity: 0.8;
}

.error-banner__dismiss {
  flex-shrink: 0;
  opacity: 0.6;
  margin-top: 0.0625rem;
  border-radius: 0.25rem;
  transition: opacity 150ms;
}
.error-banner__dismiss:hover,
.error-banner__dismiss:focus-visible {
  opacity: 1;
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
</style>
