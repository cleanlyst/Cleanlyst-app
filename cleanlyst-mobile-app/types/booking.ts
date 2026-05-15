export type BookingStatus =
  | "pending_request"
  | "accepted"
  | "declined"
  | "expired"
  | "awaiting_customer_payment"
  | "paid"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "payment_failed"
  | "cleaner_timeout"
  | "no_cleaners_available"
  | "booking_conflict";

export type BookingDraft = {
  cleanerId?: string;
  serviceId?: string;
  date?: string;
  duration?: number;
  address?: string;
  notes?: string;
};
