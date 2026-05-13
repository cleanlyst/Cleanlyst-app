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

-- 6) customer booking creation must include a service_id and own customer_id
-- expect as customer: insert succeeds when :cleaner_id and :service_id are valid.
-- replace placeholders in psql/staging harness before running.
/*
insert into public.bookings (
  customer_id,
  cleaner_id,
  service_id,
  service_title_snapshot,
  location_text,
  scheduled_start,
  scheduled_end,
  quote_cents,
  cleaner_payout_cents,
  notes
) values (
  auth.uid(),
  :'cleaner_id',
  :'service_id',
  'RLS smoke service',
  'RLS smoke address',
  now() + interval '2 days',
  now() + interval '2 days 2 hours',
  5000,
  4500,
  'RLS smoke note'
);
*/

-- 7) booking lifecycle must go through transition_booking_state
-- expect: cleaner can accept/decline own pending_request via RPC; customer can cancel early.
/*
select public.transition_booking_state(:'booking_id'::uuid, 'estimate_proposed', 'accepted');
select public.transition_booking_state(:'booking_id'::uuid, 'cleaner_declined', 'declined');
select public.transition_booking_state(:'booking_id'::uuid, 'cancelled', 'customer cancelled');
*/

-- 8) direct status updates should not be relied on for app flows
-- expect: app code does not use this; RLS may allow participant updates but RPC audit should be verified instead.
/*
select *
from public.booking_status_events
where booking_id = :'booking_id'::uuid
order by created_at desc;
*/

-- 9) reviews use reviewer_id/reviewee_id and completed-booking participant checks
-- expect: customer/cleaner participant can review the other participant after completion; non-participant is rejected.
/*
insert into public.reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
values (:'completed_booking_id'::uuid, auth.uid(), :'reviewee_id'::uuid, 5, 'RLS smoke review');
*/
