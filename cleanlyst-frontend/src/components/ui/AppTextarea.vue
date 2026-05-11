<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="textareaId" class="text-sm font-medium text-on-surface">
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="textareaId"
      v-bind="$attrs"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :required="required"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :aria-invalid="!!error"
      :aria-describedby="error ? errorId : hint ? hintId : undefined"
      :class="[
        'w-full border bg-surface-container-lowest text-on-surface text-sm',
        'px-3 py-2 rounded resize-y transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-0',
        'placeholder:text-on-surface-variant',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error
          ? 'border-error focus:ring-error'
          : 'border-outline-variant focus:ring-on-surface focus:border-on-surface',
      ]"
      @input="handleInput"
      @blur="emit('blur', $event)"
    />

    <div class="flex items-start justify-between gap-2">
      <p v-if="error" :id="errorId" class="text-xs text-error flex items-center gap-1" role="alert">
        <span class="material-symbols-outlined text-sm" aria-hidden="true">error</span>
        {{ error }}
      </p>
      <p v-else-if="hint" :id="hintId" class="text-xs text-on-surface-variant">
        {{ hint }}
      </p>
      <span v-if="maxlength" class="text-xs text-on-surface-variant ml-auto shrink-0">
        {{ (modelValue ?? '').length }}/{{ maxlength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    placeholder?: string
    hint?: string
    error?: string
    rows?: number
    maxlength?: number
    required?: boolean
    disabled?: boolean
    id?: string
  }>(),
  { rows: 4, required: false, disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
}>()

const uid = Math.random().toString(36).slice(2, 8)
const textareaId = computed(() => props.id ?? `textarea-${uid}`)
const errorId = computed(() => `${textareaId.value}-error`)
const hintId = computed(() => `${textareaId.value}-hint`)

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>
