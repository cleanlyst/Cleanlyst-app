import { defineStore } from 'pinia'
import type { BookingStatus } from '@/types/domain'
import { getBookingRequestsForCleaner, getMyBookings, transitionBookingState } from '@/services/bookingService'
import { createCheckoutSession } from '@/services/paymentService'

export const useBookingFlowStore = defineStore('bookingFlow', {
  state: () => ({
    bookings: [] as Record<string, unknown>[],
    bookingRequests: [] as Record<string, unknown>[],
    loading: false,
  }),
  actions: {
    async loadBookings() {
      this.loading = true
      try {
        this.bookings = (await getMyBookings()) ?? []
      } finally {
        this.loading = false
      }
    },
    async loadCleanerRequests() {
      this.loading = true
      try {
        this.bookingRequests = (await getBookingRequestsForCleaner()) ?? []
      } finally {
        this.loading = false
      }
    },
    async transition(bookingId: string, status: BookingStatus, note?: string) {
      await transitionBookingState(bookingId, status, note)
      await this.loadBookings()
    },
    async startCheckout(bookingId: string) {
      const result = await createCheckoutSession(bookingId)
      return result.checkout_url as string
    },
  },
})
