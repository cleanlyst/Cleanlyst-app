import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { getSupabaseClient } from '@/services/supabaseClient'

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type Message = {
  id: string
  message: string
  created_at: string
  sender_id: string
  status?: MessageStatus
}

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
      this.byBooking[bookingId] = (data ?? []).map((m) => ({ ...m, status: 'sent' as MessageStatus }))
    },

    async sendMessage(bookingId: string, senderId: string, message: string) {
      const tempId = `temp-${Date.now()}-${Math.random()}`
      const optimistic: Message = {
        id: tempId,
        message,
        created_at: new Date().toISOString(),
        sender_id: senderId,
        status: 'sending',
      }
      if (!this.byBooking[bookingId]) this.byBooking[bookingId] = []
      this.byBooking[bookingId] = [...this.byBooking[bookingId], optimistic]

      const supabase = getSupabaseClient()
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({ booking_id: bookingId, sender_id: senderId, message })
          .select('id, message, created_at, sender_id')
          .single()

        if (error) throw error

        // Replace the optimistic entry with the confirmed message.
        // Realtime INSERT event may also arrive; dedup by ID prevents double-add.
        this.byBooking[bookingId] = this.byBooking[bookingId].map((m) =>
          m.id === tempId ? { ...data, status: 'sent' as MessageStatus } : m,
        )
      } catch (e) {
        this.byBooking[bookingId] = this.byBooking[bookingId].map((m) =>
          m.id === tempId ? { ...optimistic, status: 'failed' as MessageStatus } : m,
        )
        throw e
      }
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
            // Deduplicate: if message already exists (from optimistic update), skip
            if (!this.byBooking[bookingId].some((m) => m.id === msg.id)) {
              this.byBooking[bookingId] = [
                ...this.byBooking[bookingId],
                { ...msg, status: 'sent' as MessageStatus },
              ]
            }
          },
        )
        .subscribe()
    },

    unsubscribeFromBookingMessages(bookingId: string) {
      channels[bookingId]?.unsubscribe()
      delete channels[bookingId]
    },

    clearBookingMessages(bookingId: string) {
      delete this.byBooking[bookingId]
    },
  },
})
