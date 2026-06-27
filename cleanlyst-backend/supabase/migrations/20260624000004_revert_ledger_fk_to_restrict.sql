-- =============================================================================
-- REVERT: payment_ledger_events.booking_id FK — back to RESTRICT
-- =============================================================================
-- Migration 20260624000001 changed this FK to ON DELETE CASCADE hoping
-- wipeDynamic could delete bookings and have ledger rows cascade away.
-- But PostgreSQL FK CASCADE actions run as the TABLE OWNER (postgres), not the
-- session user (service_role). The prevent_ledger_mutation trigger (even
-- without SECURITY DEFINER) fires with current_user = 'postgres' during cascade,
-- so the service_role bypass never fires and the cascade delete is blocked.
--
-- Direct deletes from service_role DO work (trigger sees current_user = 'service_role').
-- Solution: revert to RESTRICT and delete ledger rows explicitly in wipeDynamic
-- before deleting the parent booking rows.

alter table public.payment_ledger_events
  drop constraint payment_ledger_events_booking_id_fkey,
  add constraint payment_ledger_events_booking_id_fkey
    foreign key (booking_id) references public.bookings(id) on delete restrict;
