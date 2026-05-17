-- ============================================================
-- AVAILABILITY & BOOKING CONFLICT RPC
-- ============================================================
-- Provides a security-definer function so that customers can
-- check whether a cleaner has a confirmed booking that conflicts
-- with a requested time window, without exposing other booking
-- details through RLS.
-- ============================================================

-- Returns TRUE if the cleaner already has an active booking that
-- overlaps with [p_start, p_end). Statuses that are terminal/void
-- (cancelled, cleaner_declined, refunded) are excluded.
create or replace function public.cleaner_has_booking_conflict(
  p_cleaner_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from   public.bookings b
    where  b.cleaner_id      = p_cleaner_id
      and  b.status not in ('cancelled', 'cleaner_declined', 'refunded')
      and  b.scheduled_start < p_end
      and  b.scheduled_end   > p_start
  );
$$;

-- Grant execute to authenticated users so customers can call it
-- from the frontend without a service-role key.
grant execute on function public.cleaner_has_booking_conflict(uuid, timestamptz, timestamptz)
  to authenticated;

-- ============================================================
-- AVAILABILITY SLOT READ FOR CUSTOMERS
-- ============================================================
-- Returns all active recurring slots for a specific cleaner on a
-- given day-of-week. Security definer so the RLS is bypassed
-- while still scoping results to approved cleaners only.
create or replace function public.get_cleaner_availability_for_day(
  p_cleaner_id uuid,
  p_day_of_week smallint   -- PostgreSQL DOW: 0=Sun, 1=Mon … 6=Sat
)
returns table (
  start_time time,
  end_time   time
)
language sql
stable
security definer
set search_path = public
as $$
  select s.start_time, s.end_time
  from   public.availability_slots s
  join   public.cleaner_profiles   cp on cp.user_id = s.cleaner_id
  where  s.cleaner_id  = p_cleaner_id
    and  s.day_of_week = p_day_of_week
    and  s.active      = true
    and  cp.status     = 'approved';
$$;

grant execute on function public.get_cleaner_availability_for_day(uuid, smallint)
  to authenticated;
