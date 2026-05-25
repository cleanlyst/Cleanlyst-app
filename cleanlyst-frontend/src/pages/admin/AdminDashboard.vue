<template>
  <DashboardLayout :links="adminDashboardLinks" main-label="Admin dashboard">
    <AdminDashboardSection v-if="activeRouteName === 'AdminDashboard'" />
    <AdminApprovalsSection v-if="activeRouteName === 'AdminApprovals'" />
    <AdminPlatformFeesSection v-if="activeRouteName === 'AdminSubscription'" />
    <AdminFinancialsSection v-if="activeRouteName === 'AdminFinancials'" />
    <BookingManagement v-if="activeRouteName === 'BookingManagement'" />
    <AdminBookingDetailsSection v-if="activeRouteName === 'AdminBookingDetails'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { adminDashboardLinks } from '@/pages/dasboardLinks'
import AdminDashboardSection from './components/AdminDashboardSection.vue'
import AdminApprovalsSection from './components/AdminApprovalsSection.vue'
import AdminPlatformFeesSection from './components/AdminPlatformFeesSection.vue'
import AdminFinancialsSection from './components/AdminFinancialsSection.vue'
import BookingManagement from './components/BookingManagement.vue'
import AdminBookingDetailsSection from './components/AdminBookingDetailsSection.vue'

const route = useRoute()
const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'AdminDashboard',
)
</script>
