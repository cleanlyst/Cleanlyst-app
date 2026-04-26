import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types/domain'

export function useRoleGuard(requiredRole: UserRole) {
  const auth = useAuthStore()
  const hasAccess = computed(() => auth.userRole === requiredRole)
  const isPendingCleaner = computed(() => auth.userRole === 'cleaner_pending')
  const isActiveCleaner = computed(() => auth.userRole === 'cleaner_active')

  return {
    hasAccess,
    isPendingCleaner,
    isActiveCleaner,
  }
}
