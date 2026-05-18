-- Enable Supabase Realtime for tables that require live push events.
--
-- supabase_realtime is the default publication used by the Realtime service.
-- Tables not in this publication will not emit postgres_changes events.
--
-- REPLICA IDENTITY FULL is required on tables where UPDATE events need to
-- carry the full old row (needed for filtering on columns that change).
-- INSERT events work with the default replica identity, but FULL is set here
-- as a safety net for any future UPDATE subscriptions.

alter table public.messages        replica identity full;
alter table public.bookings        replica identity full;
alter table public.payments        replica identity full;

do $$
begin
  -- messages: INSERT events so both parties see new chat messages in real time
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  -- bookings: UPDATE events so status changes propagate immediately
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  -- payments: UPDATE/INSERT events for payment status changes
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;
