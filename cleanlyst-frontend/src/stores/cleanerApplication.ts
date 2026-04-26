import { defineStore } from 'pinia'
import type { CleanerApplication } from '@/types/domain'
import {
  getMyCleanerApplication,
  saveCleanerApplication,
  submitCleanerApplication,
} from '@/services/applicationService'

export const useCleanerApplicationStore = defineStore('cleanerApplication', {
  state: () => ({
    application: null as CleanerApplication | null,
    loading: false,
  }),
  actions: {
    async load() {
      this.loading = true
      try {
        this.application = await getMyCleanerApplication()
      } finally {
        this.loading = false
      }
    },
    async save(payload: Partial<CleanerApplication>) {
      if (!this.application) throw new Error('No application to update')
      this.application = await saveCleanerApplication(this.application.id, payload)
    },
    async submit() {
      if (!this.application) throw new Error('No application to submit')
      this.application = await submitCleanerApplication(this.application.id)
    },
  },
})
