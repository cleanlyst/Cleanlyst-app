import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { getSupabaseClient } from '@/services/supabaseClient'

type Message = { id: string; message: string; created_at: string; sender_id: string }

const channels: Record<string, RealtimeChannel> = {}

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    byBooking: {} as Record<string, Message[]>,
  }),
  actions: {
    async loadBookingMessages(bookingId: string) {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('messages')
        .select('id, message, created_at, sender_id')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })

      if (error) throw error
      this.byBooking[bookingId] = data ?? []
    },

    async sendMessage(bookingId: string, senderId: string, message: string) {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from('messages').insert({
        booking_id: bookingId,
        sender_id: senderId,
        message,
      })
      if (error) throw error
      await this.loadBookingMessages(bookingId)
    },

    subscribeToBookingMessages(bookingId: string) {
      if (channels[bookingId]) return
      const supabase = getSupabaseClient()
      channels[bookingId] = supabase
        .channel(`messages:booking:${bookingId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `booking_id=eq.${bookingId}`,
          },
          (payload) => {
            const msg = payload.new as Message
            if (!this.byBooking[bookingId]) this.byBooking[bookingId] = []
            if (!this.byBooking[bookingId].some((m) => m.id === msg.id)) {
              this.byBooking[bookingId].push(msg)
            }
          },
        )
        .subscribe()
    },

    unsubscribeFromBookingMessages(bookingId: string) {
      channels[bookingId]?.unsubscribe()
      delete channels[bookingId]
    },
  },
})
