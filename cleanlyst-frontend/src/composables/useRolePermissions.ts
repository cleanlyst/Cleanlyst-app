import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useRolePermissions() {
  const auth = useAuthStore()

  const isGuest = computed(() => !auth.isAuthenticated)
  const isCustomer = computed(() => auth.userRole === 'customer')
  const isCleaner = computed(
    () => auth.userRole === 'cleaner_active' || auth.userRole === 'cleaner_pending',
  )
  const isAdmin = computed(() => auth.userRole === 'admin')

  // Acquisition CTAs — only guests and customers should see these
  const showBookCleaner = computed(() => isGuest.value || isCustomer.value)
  const showJoinAsCleaner = computed(() => isGuest.value || isCustomer.value)

  // Content sections
  const showCustomerContent = computed(() => isGuest.value || isCustomer.value)
  const showCleanerContent = computed(() => isCleaner.value)
  const showAdminContent = computed(() => isAdmin.value)

  // Dashboard link target for authenticated non-customer roles
  const dashboardRouteName = computed(() => auth.dashboardRouteName)

  return {
    isGuest,
    isCustomer,
    isCleaner,
    isAdmin,
    showBookCleaner,
    showJoinAsCleaner,
    showCustomerContent,
    showCleanerContent,
    showAdminContent,
    dashboardRouteName,
  }
}
