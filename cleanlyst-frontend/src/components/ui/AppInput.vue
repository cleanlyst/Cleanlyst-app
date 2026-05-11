<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-on-surface">
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="iconLeft"
        class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant pointer-events-none"
        aria-hidden="true"
      >{{ iconLeft }}</span>

      <input
        :id="inputId"
        v-bind="$attrs"
        :value="modelValue"
        :type="type"
        :disabled="disabled"
        :required="required"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :aria-invalid="!!error"
        :aria-describedby="error ? errorId : hint ? hintId : undefined"
        :class="[
          'w-full border bg-surface-container-lowest text-on-surface text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'placeholder:text-on-surface-variant',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          iconLeft ? 'pl-9' : 'pl-3',
          iconRight ? 'pr-9' : 'pr-3',
          'py-2 rounded',
          error
            ? 'border-error focus:ring-error'
            : 'border-outline-variant focus:ring-on-surface focus:border-on-surface',
        ]"
        @input="handleInput"
        @blur="emit('blur', $event)"
      />

      <span
        v-if="iconRight"
        class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant pointer-events-none"
        aria-hidden="true"
      >{{ iconRight }}</span>
    </div>

    <p v-if="error" :id="errorId" class="text-xs text-error flex items-center gap-1" role="alert">
      <span class="material-symbols-outlined text-sm" aria-hidden="true">error</span>
      {{ error }}
    </p>
    <p v-else-if="hint" :id="hintId" class="text-xs text-on-surface-variant">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    label?: string
    type?: string
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    iconLeft?: string
    iconRight?: string
    autocomplete?: string
    id?: string
  }>(),
  { type: 'text', required: false, disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
}>()

const uid = Math.random().toString(36).slice(2, 8)
const inputId = computed(() => props.id ?? `input-${uid}`)
const errorId = computed(() => `${inputId.value}-error`)
const hintId = computed(() => `${inputId.value}-hint`)

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>
