import { supabase } from "@/services/supabase";
import { BookingDraft } from "./types";

export const createBooking = async (
  customerId: string,
  draft: BookingDraft,
) => {
  const { data, error } = await supabase.from("bookings").insert({
    customer_id: customerId,
    cleaner_id: draft.cleanerId,
    service_id: draft.serviceId,
    start_time: draft.date,
    duration_minutes: draft.duration,
    address: draft.address,
    notes: draft.notes,
    status: "pending_request",
  });

  if (error) throw error;
  return data?.[0] ?? null;
};
