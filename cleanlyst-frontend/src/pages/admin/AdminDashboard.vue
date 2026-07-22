<template>
  <DashboardLayout :links="adminDashboardLinks" main-label="Admin dashboard">
    <AdminDashboardSection v-if="activeRouteName === 'AdminDashboard'" />
    <AdminApprovalsSection v-if="activeRouteName === 'AdminApprovals'" />
    <AdminMembershipSection v-if="activeRouteName === 'AdminMembership'" />
    <AdminPlatformFeesSection v-if="activeRouteName === 'AdminPlatformFees'" />
    <AdminFinancialsSection v-if="activeRouteName === 'AdminFinancials'" />
    <AdminFinancialAuditSection v-if="activeRouteName === 'AdminFinancialAudit'" />
    <AdminBookingAuditSection v-if="activeRouteName === 'AdminBookingAudit'" />
    <BookingManagement v-if="activeRouteName === 'BookingManagement'" />
    <AdminBookingDetailsSection v-if="activeRouteName === 'AdminBookingDetails'" />
    <AdminMonitoringSection v-if="activeRouteName === 'AdminMonitoring'" />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { adminDashboardLinks } from '@/pages/dasboardLinks'
import AdminDashboardSection from './components/AdminDashboardSection.vue'
import AdminApprovalsSection from './components/AdminApprovalsSection.vue'
import AdminMembershipSection from './components/AdminMembershipSection.vue'
import AdminPlatformFeesSection from './components/AdminPlatformFeesSection.vue'
import AdminFinancialsSection from './components/AdminFinancialsSection.vue'
import BookingManagement from './components/BookingManagement.vue'
import AdminBookingDetailsSection from './components/AdminBookingDetailsSection.vue'
import AdminFinancialAuditSection from './components/AdminFinancialAuditSection.vue'
import AdminBookingAuditSection from './components/AdminBookingAuditSection.vue'
import AdminMonitoringSection from './components/AdminMonitoringSection.vue'

const route = useRoute()
const activeRouteName = computed(() =>
  typeof route.name === 'string' ? route.name : 'AdminDashboard',
)
</script>
