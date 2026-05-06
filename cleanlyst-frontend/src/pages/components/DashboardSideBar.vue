<template>
  <aside class="dashboard-sidebar">
    <nav class="dashboard-sidebar__nav">
      <router-link
        v-for="item in links"
        :key="item.name"
        :to="{ name: item.name }"
        class="dashboard-nav-link"
        :class="{ 'dashboard-nav-link--active': activeRouteName === item.name }"
      >
        <span v-if="item.icon" class="material-symbols-outlined dashboard-nav-link__icon">
          {{ item.icon }}
        </span>
        <span class="text-label-md font-label-md">{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { DashboardLinkItem } from '../dasboardLinks'

defineProps<{
  links: DashboardLinkItem[]
}>()

const route = useRoute()

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : '',
)
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.dashboard-sidebar {
  width: 100%;
  border-right: 0;
  border-bottom: 1px solid var(--outline-variant);
  background: var(--surface-container-low);
}

.dashboard-sidebar__nav {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  padding: 0.75rem;
  overflow-x: auto;
}

.dashboard-nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  padding: 0.75rem 1rem;
  color: var(--secondary);
  text-decoration: none;
  border-radius: 0.25rem;
  transition: background-color 200ms ease;
}

.dashboard-nav-link:hover {
  background: var(--surface-container);
}

.dashboard-nav-link--active {
  color: var(--on-primary);
  background: var(--primary);
}

.dashboard-nav-link--active:hover {
  background: var(--primary);
}

.dashboard-nav-link__icon {
  font-size: 20px;
}

@media (min-width: 768px) {
  .dashboard-sidebar {
    width: 16rem;
    flex: 0 0 16rem;
    border-right: 1px solid var(--outline-variant);
    border-bottom: 0;
  }

  .dashboard-sidebar__nav {
    flex-direction: column;
    padding: 1.5rem;
    overflow-x: visible;
  }
}
</style>
