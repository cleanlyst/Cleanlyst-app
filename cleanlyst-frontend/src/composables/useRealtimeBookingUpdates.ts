import { onBeforeUnmount } from 'vue'
import { getSupabaseClient } from '@/services/supabaseClient'

export function useRealtimeBookingUpdates(
  bookingId: string,
  onBookingChanged: () => Promise<void> | void,
) {
  const supabase = getSupabaseClient()
  const channel = supabase
    .channel(`booking-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      async () => {
        await onBookingChanged()
      },
    )
    .subscribe()

  onBeforeUnmount(() => {
    supabase.removeChannel(channel)
  })

  return {
    channel,
  }
}
