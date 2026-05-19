-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix availability RLS + add cleaner conflict RPC
-- Problem: customers get an empty array from availability_slots because the
--          default RLS only lets the owning cleaner read their own rows.
--          Customers need read access to check availability when booking.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow any authenticated user to READ active availability slots.
--    Cleaners retain their existing write policies unchanged.
drop policy if exists "customer_read_availability_slots" on public.availability_slots;
create policy "customer_read_availability_slots"
  on public.availability_slots
  for select
  to authenticated
  using (active = true);

-- 2. Allow any authenticated user to READ availability overrides.
--    Needed so the override check in getCleanerAvailabilityForDate can run.
drop policy if exists "customer_read_availability_overrides" on public.availability_overrides;
create policy "customer_read_availability_overrides"
  on public.availability_overrides
  for select
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Security-definer RPC: customers can check whether a cleaner has a
--    conflicting booking without needing direct SELECT on all bookings rows.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cleaner_has_booking_conflict(
  p_cleaner_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.bookings
  where cleaner_id = p_cleaner_id
    and status not in ('cancelled', 'declined', 'cleaner_declined', 'completed', 'refunded', 'disputed')
    and scheduled_start < p_end
    and scheduled_end   > p_start;

  return v_count > 0;
end;
$$;
