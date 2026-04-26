import { defineStore } from 'pinia'
import { getPendingCleanerApplications, reviewCleanerApplication } from '@/services/adminService'

export const useAdminReviewStore = defineStore('adminReview', {
  state: () => ({
    pendingApplications: [] as Record<string, unknown>[],
    loading: false,
  }),
  actions: {
    async loadPendingApplications() {
      this.loading = true
      try {
        this.pendingApplications = (await getPendingCleanerApplications()) ?? []
      } finally {
        this.loading = false
      }
    },
    async review(
      applicationId: string,
      action: 'approved' | 'rejected' | 'needs_info',
      notes?: string,
      requestedInfo?: string,
    ) {
      await reviewCleanerApplication(applicationId, action, notes, requestedInfo)
      await this.loadPendingApplications()
    },
  },
})
