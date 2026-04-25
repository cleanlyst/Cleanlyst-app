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
        <h2 class="h4">Yes Boss</h2>
      </div>

      <div v-if="activeRouteName === 'AdminDashboard'" class="section-card">
        <p class="boldFont">Dashboard</p>
        <div class="stats-row">
          <div class="stat-tile">
            <p class="small no-margin">Total bookings</p>
            <p class="boldFont no-margin">1,268</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Cancellations</p>
            <p class="boldFont no-margin">94</p>
          </div>
          <div class="stat-tile">
            <p class="small no-margin">Revenue</p>
            <p class="boldFont no-margin">GBP 124,650</p>
          </div>
        </div>
      </div>

      <div v-if="activeRouteName === 'AdminApprovals'" class="section-card">
        <p class="boldFont">Approvals</p>
        <p class="small">Review and approve new cleaner applications.</p>
      </div>

      <div v-if="activeRouteName === 'AdminSubscription'" class="section-card">
        <p class="boldFont">Subscription</p>
        <p class="small">Manage cleaner subscription settings and booking fees.</p>
      </div>

      <div v-if="activeRouteName === 'AdminFinancials'" class="section-card">
        <p class="boldFont">Financials</p>
        <p class="small">View overall revenue and platform performance.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

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

<style scoped>
.dashboard-container {
  min-height: calc(100vh - 90px);
  padding: 12px;
}
ul.side-nav-links {
  background: var(--green);
  padding: 30px 8px;
  margin: 10px 9px;
  border-radius: 8px;
}
.side-nav-links li {
  margin-bottom: 20px;
}
.nav-link {
  color: var(--white);
  text-decoration: none;
  font-weight: 500;
}
.nav-link.active {
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
