import { defineStore } from 'pinia'
import { getSupabaseClient } from '@/services/supabaseClient'
import { releasePayout } from '@/services/payments/paymentOrchestrator'

export const usePaymentsStore = defineStore('payments', {
  state: () => ({
    paymentsByBookingId: {} as Record<string, Record<string, unknown>>,
    loading: false,
  }),
  actions: {
    async loadPaymentForBooking(bookingId: string) {
      this.loading = true
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('booking_id', bookingId)
          .maybeSingle()
        if (error) throw error
        if (data) {
          this.paymentsByBookingId[bookingId] = data
        }
      } finally {
        this.loading = false
      }
    },
    async releaseBookingPayout(bookingId: string) {
      await releasePayout(bookingId)
      await this.loadPaymentForBooking(bookingId)
    },
  },
})
