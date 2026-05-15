import { supabase } from "@/services/supabase";

type BookingPayload = {
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
};

export const subscribeToBooking = (
  bookingId: string,
  callback: (payload: BookingPayload) => void,
) => {
  const channel = supabase
    .channel(`booking:${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookings",
        filter: `id=eq.${bookingId}`,
      },
      ({ new: next, old }) => callback({ old, new: next }),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
