import type { BookingStatus } from "./types";

export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending_request: [
    "accepted",
    "declined",
    "expired",
    "cleaner_timeout",
    "no_cleaners_available",
    "booking_conflict",
  ],
  accepted: ["awaiting_customer_payment", "cancelled", "cleaner_timeout"],
  declined: [],
  expired: [],
  awaiting_customer_payment: ["paid", "payment_failed", "cancelled"],
  paid: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  payment_failed: ["awaiting_customer_payment", "cancelled"],
  cleaner_timeout: [],
  no_cleaners_available: [],
  booking_conflict: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return bookingTransitions[from]?.includes(to) ?? false;
}
