-- =========================
-- PART 1: MISSING TIMESTAMPS
-- =========================
-- Intentionally skipped (immutable append-only tables — no updated_at by design):
--   booking_status_events, reviews, dispute_messages, admin_application_reviews

-- -------------------------
-- availability_slots
-- -------------------------
alter table public.availability_slots
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_availability_slots_updated_at
before update on public.availability_slots
for each row execute function public.set_updated_at();

-- -------------------------
-- messages
-- -------------------------
-- updated_at reflects when read_at was set; used for unread tracking queries.
alter table public.messages
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

-- -------------------------
-- notifications (created in 20260511100200 without updated_at)
-- -------------------------
alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

-- -------------------------
-- cleaner_application_documents
-- -------------------------
-- Has uploaded_at and reviewed_at for semantic purposes; add generic audit columns
-- alongside so queries can use a consistent column name across all tables.
alter table public.cleaner_application_documents
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Backfill created_at from uploaded_at for existing rows
update public.cleaner_application_documents
set created_at = uploaded_at
where created_at != uploaded_at;

create or replace trigger trg_cleaner_application_documents_updated_at
before update on public.cleaner_application_documents
for each row execute function public.set_updated_at();

-- -------------------------
-- payment_webhook_events
-- -------------------------
-- received_at already serves as created_at.
-- updated_at tracks when processed_at or processing_error was written.
alter table public.payment_webhook_events
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_payment_webhook_events_updated_at
before update on public.payment_webhook_events
for each row execute function public.set_updated_at();

-- =========================
-- PART 2: AUTOMATION TRIGGERS
-- =========================

-- -------------------------
-- 1. CLEANER STATS ON REVIEW
-- -------------------------
-- Keeps average_rating and review_count on cleaner_profiles accurate in real time.
-- Fires after any review insert. reviewee_id is the cleaner being reviewed;
-- if reviewee is a customer the update hits 0 rows (no-op).
create or replace function public.update_cleaner_stats_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cleaner_profiles
  set
    average_rating = (
      select coalesce(round(avg(rating)::numeric, 2), 0)
      from public.reviews
      where reviewee_id = new.reviewee_id
    ),
    review_count = (
      select count(*)
      from public.reviews
      where reviewee_id = new.reviewee_id
    )
  where user_id = new.reviewee_id;

  return new;
end;
$$;

create or replace trigger trg_update_cleaner_stats_on_review
after insert on public.reviews
for each row execute function public.update_cleaner_stats_on_review();

-- -------------------------
-- 2. CLEANER APPROVAL DATE
-- -------------------------
-- Stamps approval_date (added in 20260511100100) the moment cleaner_profiles.status
-- flips to 'approved'. Uses BEFORE so the value is set in the same row write.
create or replace function public.stamp_cleaner_approval_date()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status and new.status = 'approved' then
    new.approval_date := now();
  end if;
  return new;
end;
$$;

create or replace trigger trg_stamp_cleaner_approval_date
before update on public.cleaner_profiles
for each row execute function public.stamp_cleaner_approval_date();

-- -------------------------
-- 3. INCREMENT JOBS COMPLETED
-- -------------------------
-- Bumps total_jobs_completed on cleaner_profiles each time a booking reaches
-- 'completed'. Guards against double-counting if the trigger fires more than once
-- on the same booking by checking old.status.
create or replace function public.increment_cleaner_jobs_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'completed' then
    update public.cleaner_profiles
    set total_jobs_completed = total_jobs_completed + 1
    where user_id = new.cleaner_id;
  end if;
  return new;
end;
$$;

create or replace trigger trg_increment_cleaner_jobs_on_completion
after update on public.bookings
for each row execute function public.increment_cleaner_jobs_on_completion();

-- -------------------------
-- 4. SEED PAYOUT RECORD ON COMPLETION
-- -------------------------
-- Creates a 'pending' payout row the moment a booking is marked completed.
-- The release-payout Edge Function upserts over this with stripe_transfer_id
-- and status = 'released', so no data is lost. Gives admin a clear queue of
-- payouts that are owed but not yet released.
create or replace function public.seed_payout_on_booking_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'completed' then
    insert into public.payouts (
      booking_id,
      cleaner_id,
      amount_cents,
      currency,
      status
    )
    values (
      new.id,
      new.cleaner_id,
      new.cleaner_payout_cents,
      new.currency,
      'pending'::public.payout_status
    )
    on conflict (booking_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace trigger trg_seed_payout_on_completion
after update on public.bookings
for each row execute function public.seed_payout_on_booking_completion();

-- -------------------------
-- 5. SNAPSHOT BOOKING FINANCIALS ON INSERT
-- -------------------------
-- Populates booking_financials immediately when a booking is created so the
-- financial breakdown is always present, even before payment is captured.
-- Reads platform_settings for the current fee structure.
-- ON CONFLICT DO NOTHING: safe to run even if Edge Function pre-populates it.
create or replace function public.snapshot_booking_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee_percent        numeric(5,2);
  v_fee_fixed_cents    integer;
  v_platform_fee_cents integer;
  v_booking_fee_cents  integer;
begin
  select
    booking_fee_percent,
    booking_fee_fixed_cents
  into
    v_fee_percent,
    v_fee_fixed_cents
  from public.platform_settings
  limit 1;

  -- Total platform take = everything above the cleaner payout
  v_platform_fee_cents := new.quote_cents - new.cleaner_payout_cents;
  -- Fixed portion of the booking fee (may be 0)
  v_booking_fee_cents  := coalesce(v_fee_fixed_cents, 0);

  insert into public.booking_financials (
    booking_id,
    quote_cents,
    platform_fee_cents,
    booking_fee_cents,
    cleaner_payout_cents,
    currency
  )
  values (
    new.id,
    new.quote_cents,
    v_platform_fee_cents,
    v_booking_fee_cents,
    new.cleaner_payout_cents,
    new.currency
  )
  on conflict (booking_id) do nothing;

  return new;
end;
$$;

create or replace trigger trg_snapshot_booking_financials
after insert on public.bookings
for each row execute function public.snapshot_booking_financials();

-- -------------------------
-- 6. SUBSCRIPTION TRIAL END DATE
-- -------------------------
-- When a cleaner_subscription row is created in 'trial' status without an
-- explicit trial_ends_at, reads free_cleaner_trial_months from platform_settings
-- and sets it automatically. Prevents every Edge Function caller from having to
-- duplicate this calculation.
create or replace function public.set_subscription_trial_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_months integer;
begin
  if new.status = 'trial' and new.trial_ends_at is null then
    select free_cleaner_trial_months
    into v_trial_months
    from public.platform_settings
    limit 1;

    new.trial_ends_at :=
      new.trial_started_at + (coalesce(v_trial_months, 3) || ' months')::interval;
  end if;
  return new;
end;
$$;

create or replace trigger trg_set_subscription_trial_end
before insert on public.cleaner_subscriptions
for each row execute function public.set_subscription_trial_end();

-- -------------------------
-- 7. DOUBLE-BOOKING PREVENTION
-- -------------------------
-- Blocks a booking from becoming active (payment_authorized or in_progress)
-- if the cleaner already has an overlapping active booking for the same window.
-- Pre-payment states (pending_request, estimate_proposed) are intentionally
-- excluded — multiple customers can request the same cleaner simultaneously.
-- Uses tstzrange && operator for efficient half-open interval overlap check.
create or replace function public.prevent_cleaner_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only enforce for active booking states
  if new.status not in (
    'payment_authorized',
    'in_progress',
    'completion_pending_customer'
  ) then
    return new;
  end if;

  -- Skip check if the status hasn't changed (pure field update, not state transition)
  if TG_OP = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  if exists (
    select 1
    from public.bookings
    where cleaner_id = new.cleaner_id
      and id != new.id
      and status in ('payment_authorized', 'in_progress', 'completion_pending_customer')
      and tstzrange(scheduled_start, scheduled_end, '[)')
          && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
  ) then
    raise exception
      'CLEANER_DOUBLE_BOOKING: cleaner % already has an active booking during this time slot',
      new.cleaner_id;
  end if;

  return new;
end;
$$;

create or replace trigger trg_prevent_cleaner_double_booking
before insert or update on public.bookings
for each row execute function public.prevent_cleaner_double_booking();

-- -------------------------
-- 8. BOOKING PARTICIPANT NOTIFICATIONS
-- -------------------------
-- Inserts notification records whenever a booking changes to a state that
-- a participant needs to act on or be informed of.
-- Avoids auth.uid() — derives recipient from booking columns directly.
-- Service role bypasses RLS on notifications so no policy changes needed.
--
-- Covered transitions:
--   pending_request (INSERT)         → cleaner: "New booking request"
--   → estimate_proposed              → customer: "Booking accepted"
--   → payment_authorized             → cleaner: "Payment received, booking confirmed"
--   → in_progress                    → customer: "Cleaning in progress"
--   → completion_pending_customer    → customer: "Please confirm completion"
--   → completed                      → cleaner: "Payment will be released"
--   → cleaner_declined               → customer: "Booking declined"
--   → cancelled                      → both parties notified
--   → disputed                       → cleaner notified
create or replace function public.notify_booking_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- New booking created — notify the cleaner of an incoming request
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, type, title, body)
    values (
      new.cleaner_id,
      'booking_request',
      'New booking request',
      'A customer has sent you a new booking request.'
    );
    return new;
  end if;

  -- Status change — skip if status did not actually change
  if old.status is not distinct from new.status then
    return new;
  end if;

  case new.status

    when 'estimate_proposed' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_accepted',
        'Booking accepted',
        'Your cleaner has reviewed and accepted your booking request.'
      );

    when 'payment_authorized' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.cleaner_id,
        'payment_received',
        'Payment confirmed',
        'Your customer has paid. The booking is confirmed and ready to go.'
      );

    when 'in_progress' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_in_progress',
        'Cleaning in progress',
        'Your cleaner has started the job.'
      );

    when 'completion_pending_customer' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'completion_pending',
        'Please confirm job completion',
        'Your cleaner has marked the job as done. Please confirm to release their payment.'
      );

    when 'completed' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.cleaner_id,
        'booking_completed',
        'Job confirmed — payout queued',
        'The customer has confirmed the job is complete. Your payout will be released shortly.'
      );

    when 'cleaner_declined' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_declined',
        'Booking declined',
        'Your cleaner was unable to take this booking. Please search for another cleaner.'
      );

    when 'cancelled' then
      -- Notify both parties; either party or admin could have cancelled
      insert into public.notifications (user_id, type, title, body)
      values
        (
          new.cleaner_id,
          'booking_cancelled',
          'Booking cancelled',
          'A booking assigned to you has been cancelled.'
        ),
        (
          new.customer_id,
          'booking_cancelled',
          'Booking cancelled',
          'Your booking has been cancelled.'
        );

    when 'disputed' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.cleaner_id,
        'booking_disputed',
        'Dispute opened',
        'The customer has opened a dispute for this booking. Our team will be in touch.'
      );

    when 'refunded' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_refunded',
        'Refund issued',
        'Your dispute has been resolved and a refund has been issued.'
      );

    else
      null; -- no notification for other transitions

  end case;

  return new;
end;
$$;

create or replace trigger trg_notify_booking_participants
after insert or update on public.bookings
for each row execute function public.notify_booking_participants();
