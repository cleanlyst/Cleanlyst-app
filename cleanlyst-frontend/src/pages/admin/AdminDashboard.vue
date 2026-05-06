<template>
  <div class="admin-dashboard-page bg-background text-on-background font-body text-body">
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <nav class="admin-sidebar__nav">
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="admin-nav-link"
            :class="{ 'admin-nav-link--active': activeRouteName === item.name }"
          >
            <span class="material-symbols-outlined admin-nav-link__icon">{{ item.icon }}</span>
            <span class="text-label-md font-label-md">{{ item.label }}</span>
          </router-link>

          <div class="admin-sidebar__tools">
            <p class="admin-sidebar__tools-label">Internal Tools</p>
            <button class="admin-nav-link admin-nav-link--muted" type="button">
              <span class="material-symbols-outlined admin-nav-link__icon">settings</span>
              <span class="text-label-md font-label-md">Settings</span>
            </button>
            <button class="admin-nav-link admin-nav-link--muted" type="button">
              <span class="material-symbols-outlined admin-nav-link__icon">support_agent</span>
              <span class="text-label-md font-label-md">Support Desk</span>
            </button>
          </div>
        </nav>
      </aside>

      <div class="admin-main__container">
        <AdminDashboardSection v-if="activeRouteName === 'AdminDashboard'" />
        <AdminApprovalsSection v-if="activeRouteName === 'AdminApprovals'" />
        <AdminSubscriptionSection v-if="activeRouteName === 'AdminSubscription'" />
        <AdminFinancialsSection v-if="activeRouteName === 'AdminFinancials'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AdminDashboardSection from './components/AdminDashboardSection.vue'
import AdminApprovalsSection from './components/AdminApprovalsSection.vue'
import AdminSubscriptionSection from './components/AdminSubscriptionSection.vue'
import AdminFinancialsSection from './components/AdminFinancialsSection.vue'

const route = useRoute()

const navItems = [
  { name: 'AdminDashboard', label: 'Overview', icon: 'dashboard' },
  { name: 'AdminApprovals', label: 'Applications', icon: 'person_check' },
  { name: 'AdminSubscription', label: 'Platform Fees', icon: 'account_balance_wallet' },
  { name: 'AdminFinancials', label: 'Financials', icon: 'list_alt' },
]

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'AdminDashboard',
)
</script>

<style scoped>
:global(body) {
  font-family: 'Inter', sans-serif;
}

.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.admin-layout {
  display: flex;
  min-height: 100vh;
}

.admin-sidebar {
  position: fixed;
  left: 0;
  width: 16rem;
  height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--surface-container-low);
  border-right: 1px solid var(--outline-variant);
}

.admin-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem;
}

.admin-nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  color: var(--secondary);
  background: transparent;
  border-radius: 0.25rem;
  text-align: left;
  transition: background-color 200ms ease;
}

.admin-nav-link:hover {
  background: var(--surface-container);
}

.admin-nav-link--active {
  color: var(--on-primary);
  background: var(--primary);
}

.admin-nav-link--active:hover {
  background: var(--primary);
}

.admin-nav-link--muted {
  cursor: default;
}

.admin-nav-link--muted:hover {
  background: transparent;
}

.admin-nav-link__icon {
  font-size: 20px;
}

.admin-sidebar__tools {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--outline-variant);
}

.admin-sidebar__tools-label {
  margin: 0 0 1rem;
  padding: 0 1rem;
  color: var(--outline);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-main {
  flex: 1;
  width: 100%;
  padding: 1.5rem;
}

.admin-main__container {
  margin: 0 auto;
}

.admin-main__header {
  margin-bottom: 3rem;
}

@media (min-width: 1024px) {
  .admin-main {
    margin-left: 16rem;
    padding: 3rem;
  }
}
</style>
