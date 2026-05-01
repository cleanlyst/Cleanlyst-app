<template>
  <div class="row no-gutter dashboard-container">
    <section class="side-nav col-lg-2">
      <ul class="side-nav-links">
        <li v-for="item in navItems" :key="item.name">
          <router-link
            :to="{ name: item.name }"
            class="nav-link"
            :class="{ active: activeRouteName === item.name }"
          >
            {{ item.label }}
          </router-link>
        </li>
      </ul>
    </section>
    <section class="main-page col-lg-10">
      <div class="greeting-header">
        <h2 class="h4">Admin Overview</h2>
      </div>

      <AdminDashboardSection v-if="activeRouteName === 'AdminDashboard'" />
      <AdminApprovalsSection v-if="activeRouteName === 'AdminApprovals'" />
      <AdminSubscriptionSection v-if="activeRouteName === 'AdminSubscription'" />
      <AdminFinancialsSection v-if="activeRouteName === 'AdminFinancials'" />
    </section>
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
  { name: 'AdminDashboard', label: 'Dashboard' },
  { name: 'AdminApprovals', label: 'Approvals' },
  { name: 'AdminSubscription', label: 'Subscription' },
  { name: 'AdminFinancials', label: 'Financials' },
]

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'AdminDashboard',
)
</script>

<style>
.dashboard-container {
  min-height: calc(100vh - 90px);
  padding: 12px;
}
section.side-nav.col-lg-2 {
  border-right: 1px solid var(--grey);
}
ul.side-nav-links {
  padding: 30px 8px;
  margin: 10px 9px;
  border-radius: 8px;
}
.side-nav-links li {
  margin-bottom: 20px;
}
.nav-link {
  color: var(--grey);
  font-weight: 500;
  text-decoration: none;
}
.nav-link.active {
  color: var(--black);
  text-decoration: underline;
  text-underline-offset: 6px;
}
section.main-page.col-lg-10 {
  padding: 10px;
}
.greeting-header {
  border-bottom: 1px solid grey;
  margin-bottom: 12px;
}
.section-card {
  border: 1px solid var(--blue);
  border-radius: 8px;
  padding: 20px;
  margin-top: 14px;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.stat-tile {
  border: 1px solid var(--green);
  border-radius: 6px;
  padding: 12px;
}
@media (max-width: 768px) {
  .dashboard-container {
    padding: 4px;
  }
  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
