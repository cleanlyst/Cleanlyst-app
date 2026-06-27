-- ── Platform Observability Tables ────────────────────────────────────────────
--
-- Three tables:
--   error_events       — frontend and backend structured error log
--   analytics_events   — privacy-safe user behaviour events
--   cron_execution_log — records each pg_cron job execution for health checks
--
-- All tables:
--   - Use RLS so only the owning user (or admin/service_role) can read rows
--   - Have TTL-friendly created_at for future archival
--   - Contain NO financial amounts, card data, or raw PII beyond user_id

-- ── 1. error_events ───────────────────────────────────────────────────────────

create table if not exists public.error_events (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  level            text not null check (level in ('debug','info','warn','error','critical')),
  component        text not null,
  message          text not null,
  correlation_id   text,
  booking_id       uuid references public.bookings(id) on delete set null,
  user_id          uuid references auth.users(id) on delete set null,
  role             text,
  extra            jsonb,
  error_message    text,
  error_stack      text
);

-- Retention index — admins can query recent errors efficiently
create index if not exists error_events_created_at_idx
  on public.error_events (created_at desc);

create index if not exists error_events_level_idx
  on public.error_events (level, created_at desc);

create index if not exists error_events_booking_id_idx
  on public.error_events (booking_id)
  where booking_id is not null;

alter table public.error_events enable row level security;

-- Admins and service_role read all
create policy "admins_read_error_events" on public.error_events
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Any authenticated session can insert (used by logger.ts)
-- The row's user_id is populated by the client — not forced to auth.uid()
-- because some errors fire before auth is complete.
create policy "authenticated_insert_error_events" on public.error_events
  for insert
  with check (true);

-- ── 2. analytics_events ───────────────────────────────────────────────────────

create table if not exists public.analytics_events (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event          text not null,
  user_id        uuid references auth.users(id) on delete set null,
  correlation_id text,
  properties     jsonb
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_idx
  on public.analytics_events (event, created_at desc);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id)
  where user_id is not null;

alter table public.analytics_events enable row level security;

-- Admins read all analytics
create policy "admins_read_analytics_events" on public.analytics_events
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Any session (including anon) may insert analytics events
-- (needed for pre-auth page views)
create policy "anyone_insert_analytics_events" on public.analytics_events
  for insert
  with check (true);

-- ── 3. cron_execution_log ─────────────────────────────────────────────────────

create table if not exists public.cron_execution_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  job_name     text not null,
  duration_ms  integer,
  rows_affected integer,
  status       text not null check (status in ('success', 'error')),
  error_detail text
);

create index if not exists cron_execution_log_job_created_idx
  on public.cron_execution_log (job_name, created_at desc);

alter table public.cron_execution_log enable row level security;

-- Only service_role and admin can read/write cron log
create policy "admins_read_cron_log" on public.cron_execution_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 4. Update mark_overdue_bookings() to write to cron_execution_log ─────────
--
-- Replaces the prior version with instrumented logging so the monitoring
-- dashboard can show "last ran X minutes ago" and row counts.

create or replace function public.mark_overdue_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count     integer := 0;
  v_row       record;
  v_started   timestamptz := clock_timestamp();
  v_error     text;
begin
  begin
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
      update public.bookings
      set    status = 'awaiting_resolution'
      where  id = v_row.id;

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

    insert into public.cron_execution_log (job_name, duration_ms, rows_affected, status)
    values (
      'mark-overdue-bookings',
      extract(epoch from (clock_timestamp() - v_started))::integer * 1000,
      v_count,
      'success'
    );

    return v_count;

  exception when others then
    get stacked diagnostics v_error = message_text;
    insert into public.cron_execution_log (job_name, duration_ms, rows_affected, status, error_detail)
    values (
      'mark-overdue-bookings',
      extract(epoch from (clock_timestamp() - v_started))::integer * 1000,
      v_count,
      'error',
      v_error
    );
    raise;
  end;
end;
$$;

revoke execute on function public.mark_overdue_bookings() from public;
revoke execute on function public.mark_overdue_bookings() from anon;
revoke execute on function public.mark_overdue_bookings() from authenticated;
grant  execute on function public.mark_overdue_bookings() to service_role;
