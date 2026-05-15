<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="selectId" class="text-sm font-medium text-on-surface">
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <select
        :id="selectId"
        v-bind="$attrs"
        :value="modelValue"
        :disabled="disabled || loading"
        :required="required"
        :aria-invalid="!!error"
        :aria-describedby="error ? errorId : hint ? hintId : undefined"
        :class="[
          'w-full border bg-surface-container-lowest text-on-surface text-sm',
          'pl-3 pr-9 py-2 rounded appearance-none',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-error focus:ring-error'
            : 'border-outline-variant focus:ring-on-surface focus:border-on-surface',
        ]"
        @change="handleChange"
      >
        <option v-if="placeholder" value="" disabled :selected="!modelValue">
          {{ placeholder }}
        </option>
        <option v-for="country in COUNTRIES" :key="country" :value="country">
          {{ country }}
        </option>
      </select>

      <span
        class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-base text-on-surface-variant pointer-events-none"
        aria-hidden="true"
        >expand_more</span
      >
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
import { COUNTRIES, type Country } from '@/utils/countrylist'

const props = withDefaults(
  defineProps<{
    modelValue?: string | Country | null
    label?: string
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    loading?: boolean
    id?: string
  }>(),
  {
    required: false,
    disabled: false,
    loading: false,
    placeholder: 'Select a country',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const uid = Math.random().toString(36).slice(2, 8)
const selectId = computed(() => props.id ?? `country-select-${uid}`)
const errorId = computed(() => `${selectId.value}-error`)
const hintId = computed(() => `${selectId.value}-hint`)

function handleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  // Validate that the selected value is in COUNTRIES
  if (value && !COUNTRIES.includes(value as Country)) {
    console.warn(`Invalid country selected: ${value}`)
    return
  }
  emit('update:modelValue', value)
}
</script>
