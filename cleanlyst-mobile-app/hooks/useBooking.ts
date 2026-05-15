import { useBookingStore } from "@/features/bookings/bookingStore";

export function useBooking() {
  return useBookingStore();
}
