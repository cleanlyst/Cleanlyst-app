<template>
  <div class="dashboard-layout">
    <DashboardSideBar :links="links" />
    <main class="dashboard-main" :aria-label="mainLabel">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import DashboardSideBar from '@/components/DashboardSideBar.vue'
import type { DashboardLinkItem } from '@/pages/dasboardLinks'

withDefaults(
  defineProps<{
    links: DashboardLinkItem[]
    mainLabel?: string
  }>(),
  { mainLabel: 'Dashboard content' },
)
</script>

<style scoped>
.dashboard-layout {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 4rem); /* subtract fixed header height */
}

.dashboard-main {
  flex: 1;
  width: 100%;
  padding: 1rem;
  overflow-x: hidden;
}

@media (min-width: 768px) {
  .dashboard-layout {
    flex-direction: row;
  }

  .dashboard-main {
    width: calc(100% - 16rem);
    padding: 1.5rem 2rem;
  }
}
</style>
