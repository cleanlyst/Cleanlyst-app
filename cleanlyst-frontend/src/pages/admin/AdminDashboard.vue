<template>
  <div class="admin-dashboard-page bg-background text-on-background font-body text-body">
    <div class="dashboard-layout">
      <DashboardSideBar :links="adminDashboardLinks" />
      <div class="admin-main__container">
        <AdminDashboardSection v-if="activeRouteName === 'AdminDashboard'" />
        <AdminApprovalsSection v-if="activeRouteName === 'AdminApprovals'" />
        <AdminSubscriptionSection v-if="activeRouteName === 'AdminSubscription'" />
        <AdminFinancialsSection v-if="activeRouteName === 'AdminFinancials'" />
        <BookingManagement v-if="activeRouteName === 'BookingManagement'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DashboardSideBar from '../../components/DashboardSideBar.vue'
import { adminDashboardLinks } from '../dasboardLinks'
import AdminDashboardSection from './components/AdminDashboardSection.vue'
import AdminApprovalsSection from './components/AdminApprovalsSection.vue'
import AdminSubscriptionSection from './components/AdminSubscriptionSection.vue'
import AdminFinancialsSection from './components/AdminFinancialsSection.vue'
import BookingManagement from './components/BookingManagement.vue'

const route = useRoute()

const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'AdminDashboard',
)
</script>

<style scoped>
:global(body) {
  font-family: 'Inter', sans-serif;
}

.dashboard-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.admin-main__container {
  width: 100%;
  max-width: 100%;
  padding: 1rem;
}

@media (min-width: 768px) {
  .dashboard-layout {
    flex-direction: row;
  }

  .admin-main__container {
    width: calc(100% - 16rem);
    padding: 2rem;
  }
}
</style>
