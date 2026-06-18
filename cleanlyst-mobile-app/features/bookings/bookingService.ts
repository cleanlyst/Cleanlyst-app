import { supabase } from "@/services/supabase";
import type { BookingDraft } from "./types";

export async function createBookingRequest(
  customerId: string,
  draft: BookingDraft,
): Promise<{ id: string }> {
  const scheduledStart = draft.scheduledStart ?? draft.date;
  const scheduledEnd =
    draft.scheduledEnd ??
    (draft.date && draft.duration
      ? new Date(new Date(draft.date).getTime() + draft.duration * 60000).toISOString()
      : null);

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      cleaner_id: draft.cleanerId,
      service_id: draft.serviceId,
      service_title_snapshot: draft.serviceTitleSnapshot,
      category_snapshot: draft.serviceCategorySnapshot ?? null,
      description_snapshot: draft.serviceDescriptionSnapshot ?? null,
      location_text: draft.address ?? '',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      quote_cents: draft.quoteCents ?? 0,
      cleaner_payout_cents: draft.cleanerPayoutCents ?? draft.quoteCents ?? 0,
      currency: draft.currency ?? 'GBP',
      status: 'pending_request',
      payment_status: 'unpaid',
      duration_minutes: draft.duration ?? null,
      notes: draft.notes ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data as { id: string };
}
