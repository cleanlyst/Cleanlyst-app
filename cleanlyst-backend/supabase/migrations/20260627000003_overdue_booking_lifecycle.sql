-- ── Overdue Booking Lifecycle ───────────────────────────────────────────────
--
-- Adds two new booking status values:
--   awaiting_resolution  — set automatically when a booking passes scheduled_start
--                          + 24 h with no completion or cancellation recorded
--   no_show_reported     — set when the customer formally reports the cleaner
--                          did not attend
--
-- Provides two server-side functions:
--   mark_overdue_bookings()        — idempotent batch transition; safe to call
--                                    from pg_cron hourly
--   report_no_show_overdue(uuid)   — customer RPC to escalate awaiting_resolution
--                                    → no_show_reported
--
-- pg_cron schedule is registered at the bottom; requires the pg_cron extension
-- enabled in Supabase Dashboard → Database → Extensions.
-- If pg_cron is not yet enabled the DO block silently skips registration.

-- ── 1. Enum values ───────────────────────────────────────────────────────────

alter type public.booking_status add value if not exists 'awaiting_resolution';
alter type public.booking_status add value if not exists 'no_show_reported';

-- ── 2. mark_overdue_bookings() ───────────────────────────────────────────────
--
-- Runs as SECURITY DEFINER (postgres role) and sets app.tbs_active so the
-- guard_booking_status_write trigger allows the direct UPDATE.
-- Returns the number of bookings transitioned.

create or replace function public.mark_overdue_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer := 0;
  v_row    record;
begin
  -- Allow the guard trigger to pass for this session
  perform set_config('app.tbs_active', 'true', true);

  for v_row in
    select id, status, customer_id
    from   public.bookings
    where  completed_at  is null
      and  cancelled_at  is null
      and  scheduled_start < now() - interval '24 hours'
      and  status::text not in (
             'awaiting_resolution', 'no_show_reported',
             'completed', 'payout_released',
             'cancelled', 'refunded', 'disputed',
             'cleaner_declined', 'declined', 'cleaner_cancelled'
           )
  loop
    -- Transition status
    update public.bookings
    set    status = 'awaiting_resolution'
    where  id = v_row.id;

    -- Full audit trail
    insert into public.booking_status_events
      (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (
      v_row.id,
      v_row.status,
      'awaiting_resolution',
      null,
      'Automatically transitioned — booking passed scheduled date + 24 h with no completion or cancellation recorded.',
      'system'
    );

    -- Notify customer
    insert into public.notifications (user_id, booking_id, type, title, body)
    values (
      v_row.customer_id,
      v_row.id,
      'BOOKING_OVERDUE',
      'Booking requires your attention',
      'Your booking appears not to have been completed. If your cleaner did not attend, you can report a no-show from the booking details page.'
    );

    v_count := v_count + 1;
  end loop;

  perform set_config('app.tbs_active', 'false', true);
  return v_count;
end;
$$;

revoke execute on function public.mark_overdue_bookings() from public;
revoke execute on function public.mark_overdue_bookings() from anon;
revoke execute on function public.mark_overdue_bookings() from authenticated;
grant  execute on function public.mark_overdue_bookings() to service_role;

-- ── 3. report_no_show_overdue(booking_id) ───────────────────────────────────
--
-- Called by the authenticated customer.
-- Transitions awaiting_resolution → no_show_reported and notifies admins.

create or replace function public.report_no_show_overdue(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking   record;
  v_actor_id  uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select id, status, customer_id
  into   v_booking
  from   public.bookings
  where  id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.customer_id <> v_actor_id then
    raise exception 'Only the customer who made this booking can report a no-show';
  end if;

  if v_booking.status::text <> 'awaiting_resolution' then
    raise exception
      'No-show can only be reported when booking is awaiting resolution (current status: %)',
      v_booking.status;
  end if;

  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set    status = 'no_show_reported'
  where  id = p_booking_id;

  insert into public.booking_status_events
    (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (
    p_booking_id,
    v_booking.status,
    'no_show_reported',
    v_actor_id,
    'Customer reported that the cleaner did not attend this booking.',
    'customer'
  );

  -- Notify all admins
  insert into public.notifications (user_id, booking_id, type, title, body)
  select
    p.id,
    p_booking_id,
    'NO_SHOW_REPORTED',
    'No-show reported by customer',
    'A customer has reported that their cleaner did not attend. Please review the booking and take appropriate action (refund or reassignment).'
  from   public.profiles p
  where  p.role = 'admin'
  limit  10;

  perform set_config('app.tbs_active', 'false', true);
end;
$$;

grant  execute on function public.report_no_show_overdue(uuid) to authenticated;
revoke execute on function public.report_no_show_overdue(uuid) from anon;

-- ── 4. pg_cron schedule ──────────────────────────────────────────────────────
-- Runs mark_overdue_bookings() at the top of every hour.
-- Silently skips if pg_cron extension is not yet enabled.

do $$
begin
  perform cron.schedule(
    'mark-overdue-bookings',
    '0 * * * *',
    $job$select public.mark_overdue_bookings()$job$
  );
exception when others then
  -- pg_cron not enabled. Enable it in Supabase Dashboard → Database → Extensions,
  -- then run: select cron.schedule('mark-overdue-bookings','0 * * * *','select public.mark_overdue_bookings()');
  null;
end;
$$;
