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
  cleanerName?: string;
  serviceId?: string;
  serviceTitleSnapshot?: string;
  serviceCategorySnapshot?: string;
  serviceDescriptionSnapshot?: string;
  quoteCents?: number;
  cleanerPayoutCents?: number;
  currency?: string;
  date?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  duration?: number;
  hourlyRateCents?: number;
  address?: string;
  notes?: string;
};
