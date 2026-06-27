<template>
  <Teleport to="body">
    <div
      class="toast-stack"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Notifications"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-item--${toast.type}`"
          role="alert"
        >
          <span
            class="material-symbols-outlined toast-icon"
            aria-hidden="true"
          >{{ iconMap[toast.type] }}</span>
          <p class="toast-message">{{ toast.message }}</p>
          <button
            type="button"
            class="toast-close"
            aria-label="Dismiss notification"
            @click="remove(toast.id)"
          >
            <span class="material-symbols-outlined" style="font-size: 1rem;">close</span>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast, type ToastType } from '@/composables/useToast'

const { toasts, remove } = useToast()

const iconMap: Record<ToastType, string> = {
  success: 'check_circle',
  error:   'error',
  warning: 'warning',
  info:    'info',
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(22rem, calc(100vw - 2rem));
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  font-size: 0.875rem;
  line-height: 1.4;
  pointer-events: all;
  border: 1px solid transparent;
}

.toast-item--success {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #14532d;
}
.toast-item--error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #7f1d1d;
}
.toast-item--warning {
  background: #fffbeb;
  border-color: #fde68a;
  color: #78350f;
}
.toast-item--info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e3a8a;
}

.toast-icon {
  font-size: 1.125rem;
  flex-shrink: 0;
  margin-top: 0.0625rem;
}
.toast-item--success .toast-icon { color: #16a34a; }
.toast-item--error   .toast-icon { color: #dc2626; }
.toast-item--warning .toast-icon { color: #d97706; }
.toast-item--info    .toast-icon { color: #2563eb; }

.toast-message {
  flex: 1;
  font-weight: 500;
}

.toast-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  opacity: 0.6;
  transition: opacity 150ms ease;
  margin-left: 0.25rem;
  margin-top: 0.0625rem;
}
.toast-close:hover,
.toast-close:focus-visible {
  opacity: 1;
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

/* Transition animations */
.toast-enter-active {
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-leave-active {
  transition: all 150ms ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(0.5rem);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}
.toast-move {
  transition: transform 150ms ease;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: opacity 150ms ease;
    transform: none !important;
  }
}
</style>
