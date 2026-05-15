import { useEffect } from "react";
import { subscribeToBooking } from "@/services/realtime";

type BookingCallback = (payload: {
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
}) => void;

export function useRealtimeBooking(
  bookingId: string | null,
  callback: BookingCallback,
) {
  useEffect(() => {
    if (!bookingId) {
      return;
    }

    const unsubscribe = subscribeToBooking(bookingId, callback);
    return unsubscribe;
  }, [bookingId, callback]);
}
