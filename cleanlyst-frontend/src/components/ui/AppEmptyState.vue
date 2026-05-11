<template>
  <div class="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
    <span
      v-if="icon"
      class="material-symbols-outlined text-4xl text-on-surface-variant"
      aria-hidden="true"
    >{{ icon }}</span>
    <div class="space-y-1">
      <p class="text-sm font-medium text-on-surface">{{ title }}</p>
      <p v-if="description" class="text-sm text-on-surface-variant max-w-sm">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  { icon: 'inbox' },
)
</script>
