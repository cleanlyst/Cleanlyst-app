<template>
  <div
    :class="['rounded border bg-surface-container-lowest', paddingClass, $attrs.class]"
    v-bind="omitClass($attrs)"
  >
    <div v-if="title || $slots.header" class="flex items-center justify-between mb-4">
      <h3 v-if="title" class="text-sm font-semibold text-on-surface">{{ title }}</h3>
      <slot name="header" />
    </div>
    <slot />
    <div v-if="$slots.footer" class="mt-4 pt-4 border-t border-outline-variant">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    padding?: 'none' | 'sm' | 'md' | 'lg'
  }>(),
  { padding: 'md' },
)

defineOptions({ inheritAttrs: false })

const paddingClass = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

function omitClass(attrs: Record<string, unknown>) {
  const rest = { ...attrs }
  delete (rest as Record<string, unknown>)['class']
  return rest
}
</script>
