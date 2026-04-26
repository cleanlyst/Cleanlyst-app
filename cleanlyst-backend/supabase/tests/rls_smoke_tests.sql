-- Run after `supabase db reset` and authenticated test users are created.
-- Purpose: smoke test critical RLS boundaries for customer, cleaner_pending,
-- cleaner_active, and admin roles.

-- 1) customer cannot read another customer's preferences
-- expect: 0 rows
select *
from public.customer_preferences
where customer_id <> auth.uid();

-- 2) cleaner_pending cannot read booking_requests assigned to other cleaners
-- expect: 0 rows
select *
from public.booking_requests
where cleaner_id <> auth.uid();

-- 3) cleaner_active can read own assigned booking_requests
-- expect: >= 0 rows and no error
select *
from public.booking_requests
where cleaner_id = auth.uid();

-- 4) non-admin cannot read platform_settings
-- expect: permission denied / 0 rows depending on caller context
select *
from public.platform_settings;

-- 5) participant can read own booking messages only
-- expect: no rows for non-participant booking ids
select *
from public.messages
where booking_id in (
  select b.id
  from public.bookings b
  where b.customer_id <> auth.uid() and b.cleaner_id <> auth.uid()
);
