import { defineStore } from 'pinia'
import { getSupabaseClient } from '@/services/supabaseClient'

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    byBooking: {} as Record<
      string,
      Array<{ id: string; body: string; created_at: string; sender_id: string }>
    >,
  }),
  actions: {
    async loadBookingMessages(bookingId: string) {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('messages')
        .select('id, body, created_at, sender_id')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })

      if (error) throw error
      this.byBooking[bookingId] = data ?? []
    },
    async sendMessage(bookingId: string, senderId: string, body: string) {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from('messages').insert({
        booking_id: bookingId,
        sender_id: senderId,
        body,
      })
      if (error) throw error
      await this.loadBookingMessages(bookingId)
    },
  },
})
