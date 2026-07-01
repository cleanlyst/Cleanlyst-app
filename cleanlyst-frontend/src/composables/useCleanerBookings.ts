import { computed, ref } from 'vue'
import type { BookingStatus } from '@/types/domain'
import { getCleanerBookings, transitionBookingState, type BookingListRow } from '@/services/bookingService'

export type CleanerBooking = BookingListRow

export function useCleanerBookings() {
  const bookings = ref<CleanerBooking[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const bookingTotals = computed(() => ({
    // pay-before-accept: "pending" for the cleaner means paid bookings awaiting acceptance
    pending: bookings.value.filter((b) => b.status === 'payment_authorized').length,
    accepted: bookings.value.filter((b) =>
      [
        'accepted',
        'paid',
        'paid_pending_start',
        'estimate_proposed',
        'awaiting_customer_payment',
        'in_progress',
        'completion_pending_customer',
        'cleaner_no_show',
      ].includes(b.status),
    ).length,
    completed: bookings.value.filter((b) => b.status === 'completed').length,
  }))

  async function load(cleanerId: string) {
    loading.value = true
    errorMessage.value = ''
    try {
      bookings.value = await getCleanerBookings(cleanerId)
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
      bookings.value = []
    } finally {
      loading.value = false
    }
  }

  async function transition(id: string, status: BookingStatus, note?: string) {
    await transitionBookingState(id, status, note)
  }

  return { bookings, loading, errorMessage, bookingTotals, load, transition }
}
