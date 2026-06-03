import { computed, type Ref } from 'vue'
import type { BookingDetailRow } from '@/services/bookingService'
import {
  canStartCleaning,
  isWithinStartWindow,
  canComplete,
  canCancelCustomer,
  cannotAttend,
  acceptBooking,
  declineBooking,
  startCleaning,
  completeCleaning,
  cancelAsCustomer,
  markCannotAttend,
} from '@/services/bookingLifecycleService'

export function useBookingLifecycle(booking: Ref<BookingDetailRow | null>) {
  const canStart = computed(() => !!booking.value && canStartCleaning(booking.value))
  const withinStartWindow = computed(() => !!booking.value && isWithinStartWindow(booking.value))
  const canEnd = computed(() => !!booking.value && canComplete(booking.value))
  const canCancel = computed(() => !!booking.value && canCancelCustomer(booking.value))
  const canMarkCannotAttend = computed(() => !!booking.value && cannotAttend(booking.value))

  function countdownText(): string {
    if (!booking.value) return ''
    const start = new Date(booking.value.scheduled_start)
    const diffMs = start.getTime() - Date.now()
    if (diffMs <= 0) return '0m'
    const minutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) return `${hours}h ${remainingMinutes}m`
    return `${remainingMinutes}m`
  }

  return {
    canStart,
    withinStartWindow,
    canEnd,
    canCancel,
    canMarkCannotAttend,
    countdownText,
    // Re-export actions so components only import from this composable
    acceptBooking,
    declineBooking,
    startCleaning,
    completeCleaning,
    cancelAsCustomer,
    markCannotAttend,
  }
}
