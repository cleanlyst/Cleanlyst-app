import { computed, ref } from 'vue'
import {
  cancelBooking as cancelBookingRequest,
  getCustomerBookings,
  type BookingListRow,
} from '@/services/bookingService'

export interface CustomerBooking extends BookingListRow {
  cleaner_id: string | null
  cleaner_name: string | null
}

export function useCustomerBookings() {
  const bookings = ref<CustomerBooking[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const bookingTotals = computed(() => ({
    pending: bookings.value.filter((b) => b.status === 'pending_request').length,
    accepted: bookings.value.filter((b) =>
      [
        'accepted',
        'paid',              // EPIC 4: upfront-payment bookings live here after acceptance
        'paid_pending_start',
        'estimate_proposed',
        'awaiting_customer_payment',
        'payment_authorized',
        'in_progress',
        'completion_pending_customer',
        'cleaner_no_show',
        'reassign_requested',
      ].includes(b.status),
    ).length,
    completed: bookings.value.filter((b) => b.status === 'completed').length,
  }))

  async function load(customerId: string, resolveCleanerNames?: (cleanerIds: string[]) => Promise<Map<string, string>>) {
    loading.value = true
    errorMessage.value = ''
    try {
      const rows = await getCustomerBookings(customerId)
      const cleanerIds = [...new Set(rows.map((row) => row.cleaner_id).filter(Boolean))] as string[]
      const cleanerNames = resolveCleanerNames && cleanerIds.length
        ? await resolveCleanerNames(cleanerIds)
        : new Map<string, string>()

      bookings.value = rows.map((row) => ({
        ...row,
        cleaner_id: row.cleaner_id ?? null,
        cleaner_name: row.cleaner_id ? cleanerNames.get(row.cleaner_id) ?? null : null,
      }))
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load bookings.'
      bookings.value = []
    } finally {
      loading.value = false
    }
  }

  async function cancel(id: string) {
    await cancelBookingRequest(id)
  }

  return { bookings, loading, errorMessage, bookingTotals, load, cancel }
}
