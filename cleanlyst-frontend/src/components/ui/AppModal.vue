<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        :aria-modal="true"
        :aria-labelledby="titleId"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="closeOnBackdrop && emit('update:modelValue', false)"
        />

        <!-- Panel -->
        <div
          ref="panelRef"
          :class="[
            'relative w-full bg-surface-container-lowest rounded-lg border shadow-lg flex flex-col max-h-[90vh]',
            widthClass,
          ]"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0"
          >
            <h6 :id="titleId" class="text-base font-semibold text-on-surface">
              <slot name="header">{{ title }}</slot>
            </h6>
            <button
              v-if="showClose"
              type="button"
              class="material-symbols-outlined text-xl text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Close dialog"
              @click="emit('update:modelValue', false)"
            >
              close
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 border-t border-outline-variant shrink-0 flex items-center justify-end gap-3"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showClose?: boolean
    closeOnBackdrop?: boolean
  }>(),
  { size: 'md', showClose: true, closeOnBackdrop: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const uid = Math.random().toString(36).slice(2, 8)
const titleId = `modal-title-${uid}`
const panelRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} satisfies Record<NonNullable<typeof props.size>, string>

const widthClass = SIZE_MAP[props.size]

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function getFocusable(): HTMLElement[] {
  return panelRef.value ? Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !panelRef.value) return
  const focusable = getFocusable()
  if (focusable.length === 0) return
  const first = focusable[0] as HTMLElement
  const last = focusable[focusable.length - 1] as HTMLElement
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') emit('update:modelValue', false)
  else trapFocus(e)
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

watch(
  () => props.modelValue,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement
      // Wait for the DOM to render the modal panel before focusing
      setTimeout(() => {
        const focusable = getFocusable()
        if (focusable.length) (focusable[0] as HTMLElement).focus()
      }, 50)
    } else {
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
)
</script>
