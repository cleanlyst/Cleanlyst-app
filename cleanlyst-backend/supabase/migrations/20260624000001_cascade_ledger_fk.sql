-- =============================================================================
-- FIX: payment_ledger_events.booking_id — change FK to ON DELETE CASCADE
-- =============================================================================
-- The original FK had no ON DELETE action (default = RESTRICT). This caused
-- wipeDynamic test helpers to fail when the Stripe webhook inserted a
-- payment_ledger_events row between wipeDynamic's delete of that table and
-- its delete of bookings — a race condition. With CASCADE, deleting a booking
-- automatically deletes its ledger events, eliminating the race.

alter table public.payment_ledger_events
  drop constraint payment_ledger_events_booking_id_fkey,
  add constraint payment_ledger_events_booking_id_fkey
    foreign key (booking_id) references public.bookings(id) on delete cascade;
