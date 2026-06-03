-- ============================================================
-- EPIC 4 — Booking Lifecycle & State Machine
--
-- Canonical lifecycle:
--   pending_request → accepted → paid → in_progress
--   → completed → (payout_released event in audit log)
--
-- Alternate paths:
--   any   → cancelled      (customer, admin)
--   any   → cleaner_cancelled  (cleaner cannot attend)
--   pending_request / accepted / paid → declined   (cleaner)
--   accepted / paid → cleaner_no_show  (customer, after start time)
--   completed → disputed   (customer)
--
-- RPCs added / modified:
--   transition_booking_state  — full lifecycle validation
--   start_booking             — requires status = 'paid'
--   complete_booking          — emits payout_released audit event
--   cancel_booking_customer   — 24-hour refund rule
--   cleaner_cannot_attend     — cleaner marks unavailability
--   cleaner_has_booking_conflict — exclude cleaner_cancelled
-- ============================================================

-- ── 1. Schema additions ──────────────────────────────────────

alter table public.booking_status_events
  add column if not exists notes      text,
  add column if not exists actor_role text;   -- 'customer' | 'cleaner' | 'admin' | 'system'

alter table public.cleaner_profiles
  add column if not exists cancellation_count integer not null default 0;

-- 'paid' already exists from init schema
alter type public.booking_status add value if not exists 'payout_released';
alter type public.booking_status add value if not exists 'cleaner_cancelled';

-- ── 2. transition_booking_state — EPIC 4 state machine ──────

create or replace function public.transition_booking_state(
  p_booking_id    uuid,
  p_target_status public.booking_status,
  p_note          text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking           public.bookings;
  v_source_status     public.booking_status;
  v_actor_is_customer boolean;
  v_actor_is_cleaner  boolean;
  v_actor_is_admin    boolean;
  v_actor_role        text;
  v_is_allowed        boolean := false;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_source_status     := v_booking.status;
  v_actor_is_customer := v_booking.customer_id = auth.uid();
  v_actor_is_cleaner  := v_booking.cleaner_id  = auth.uid();
  v_actor_is_admin    := public.is_admin();

  if not (v_actor_is_customer or v_actor_is_cleaner or v_actor_is_admin) then
    raise exception 'Not authorised to transition this booking';
  end if;

  v_actor_role := case
    when v_actor_is_admin    then 'admin'
    when v_actor_is_cleaner  then 'cleaner'
    when v_actor_is_customer then 'customer'
    else 'system'
  end;

  -- ── EPIC 4 canonical transitions ──────────────────────────
  -- pending_request → accepted  (cleaner accepts)
  if v_source_status = 'pending_request' and p_target_status = 'accepted' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- accepted → paid  (auto-advance after acceptance when payment captured)
  elsif v_source_status = 'accepted' and p_target_status = 'paid' and v_actor_is_admin then
    v_is_allowed := true;

  -- paid → in_progress  (cleaner starts job, 60-min window)
  elsif v_source_status = 'paid' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  -- accepted → in_progress  (backward compat: accepted bookings not yet on paid status)
  elsif v_source_status = 'accepted' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  -- in_progress → completed  (cleaner completes)
  elsif v_source_status = 'in_progress' and p_target_status = 'completed' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- completed → disputed  (customer raises dispute)
  elsif v_source_status = 'completed' and p_target_status = 'disputed' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;

  -- disputed → resolved paths  (admin only)
  elsif v_source_status = 'disputed' and p_target_status in ('refunded', 'completed') and v_actor_is_admin then
    v_is_allowed := true;

  -- ── DECLINE ───────────────────────────────────────────────
  elsif v_source_status = 'pending_request' and p_target_status in ('declined', 'cleaner_declined') and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;

  -- ── CANCELLATION (customer or admin) ──────────────────────
  elsif v_source_status in ('pending_request', 'accepted', 'paid') and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;

  -- ── LEGACY PATHS (estimate/payment flows) ─────────────────
  elsif v_source_status = 'paid_pending_start' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'scheduled' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'pending_request' and p_target_status = 'estimate_proposed' and v_actor_is_cleaner then
    v_is_allowed := true;
  elsif v_source_status = 'estimate_proposed' and p_target_status = 'awaiting_customer_payment' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'awaiting_customer_payment' and p_target_status = 'payment_authorized' and v_actor_is_customer then
    v_is_allowed := true;
  elsif v_source_status = 'payment_authorized' and p_target_status = 'in_progress' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'in_progress' and p_target_status = 'completion_pending_customer' and (v_actor_is_cleaner or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'completion_pending_customer' and p_target_status in ('completed', 'disputed') and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'estimate_proposed' and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;
  elsif v_source_status = 'awaiting_customer_payment' and p_target_status = 'cancelled' and (v_actor_is_customer or v_actor_is_admin) then
    v_is_allowed := true;

  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition: % → % (actor: %)', v_source_status, p_target_status, v_actor_role;
  end if;

  update public.bookings
  set status     = p_target_status,
      decline_reason = case when p_target_status in ('declined','cleaner_declined') then coalesce(p_note, decline_reason) else decline_reason end,
      accepted_at    = case when p_target_status in ('accepted','paid') and accepted_at is null then now() else accepted_at end,
      started_at     = case when p_target_status = 'in_progress' then now() else started_at end,
      completed_at   = case when p_target_status = 'completed' then now() else completed_at end,
      customer_confirmed_completed_at = case when p_target_status = 'completed' then now() else customer_confirmed_completed_at end,
      dispute_opened_at  = case when p_target_status = 'disputed' then now() else dispute_opened_at end,
      dispute_resolved_at = case when p_target_status in ('completed','refunded') and v_source_status = 'disputed' then now() else dispute_resolved_at end,
      cancelled_at       = case when p_target_status in ('cancelled','cleaner_cancelled') then now() else cancelled_at end,
      cancellation_reason = case when p_target_status in ('cancelled','cleaner_cancelled') then coalesce(p_note, cancellation_reason) else cancellation_reason end,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_source_status, p_target_status, auth.uid(), p_note, v_actor_role);

  -- Auto-advance accepted → paid if payment already captured
  if p_target_status = 'accepted' and v_booking.payment_status = 'captured' then
    update public.bookings
    set status = 'paid', updated_at = now()
    where id = p_booking_id
    returning * into v_booking;

    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (p_booking_id, 'accepted', 'paid', auth.uid(), 'Auto-advanced: payment already captured', 'system');
  end if;

  -- Create dispute record when transitioning to disputed
  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id, auth.uid(), coalesce(p_note, 'Dispute opened'))
    on conflict (booking_id) do nothing;
  end if;

  -- Notifications
  if p_target_status = 'accepted' or p_target_status = 'paid' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_accepted', 'Booking confirmed',
            'Your cleaner has accepted the booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id))
    on conflict do nothing;

  elsif p_target_status = 'declined' or p_target_status = 'cleaner_declined' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_declined', 'Booking declined',
            'Your cleaner was unable to accept this booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'in_progress' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_in_progress', 'Cleaning started',
            'Your cleaner has started the job.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'completed' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_completed', 'Cleaning complete',
            'Your cleaner has marked the job as complete.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'cancelled' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.cleaner_id, 'booking_cancelled', 'Booking cancelled',
            'The booking has been cancelled.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  elsif p_target_status = 'disputed' then
    declare v_admin_id uuid;
    begin
      for v_admin_id in select id from public.profiles where role = 'admin' loop
        insert into public.notifications (user_id, type, title, body, booking_id, metadata)
        values (v_admin_id, 'booking_disputed', 'Dispute opened',
                'A customer has raised a dispute on a completed booking.',
                p_booking_id, jsonb_build_object('booking_id', p_booking_id));
      end loop;
    end;

  elsif p_target_status = 'refunded' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Refund issued',
            'A refund has been issued for your booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  end if;

  return v_booking;
end;
$$;

-- ── 3. start_booking — require status = 'paid' ───────────────

create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  -- Accept both 'paid' (EPIC 4) and 'accepted' (legacy backward compat)
  if v_booking.status not in ('paid', 'accepted') then
    raise exception 'Booking must be paid/accepted to start (current: %)', v_booking.status;
  end if;
  if v_booking.payment_status != 'captured' then
    raise exception 'Cannot start booking: customer payment has not been received';
  end if;
  if v_booking.started_at is not null then
    return v_booking;
  end if;
  if now() < v_booking.scheduled_start - interval '60 minutes' then
    raise exception 'Start Cleaning is available 1 hour before the booking time';
  end if;

  update public.bookings
  set status     = 'in_progress',
      started_at = now(),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, 'paid', 'in_progress', auth.uid(), 'cleaner');

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'booking_in_progress', 'Cleaning started',
          'Your cleaner has started the job.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  return v_booking;
end;
$$;

-- ── 4. complete_booking — emit payout_released audit event ───

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking              public.bookings;
  v_cleaner_payout_cents bigint;
  v_platform_fee_cents   bigint;
  v_payment_id           uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status != 'in_progress' then
    raise exception 'Booking must be in_progress to complete (current: %)', v_booking.status;
  end if;
  if v_booking.payment_status != 'captured' then
    raise exception 'Cannot complete booking: payment not yet captured (current: %)', v_booking.payment_status;
  end if;

  select
    coalesce(bf.cleaner_payout_cents, v_booking.cleaner_payout_cents, 0),
    coalesce(bf.platform_revenue_cents, bf.platform_fee_cents,
             greatest(coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0))
  into v_cleaner_payout_cents, v_platform_fee_cents
  from public.booking_financials bf
  where bf.booking_id = p_booking_id;

  if v_cleaner_payout_cents is null then
    v_cleaner_payout_cents := coalesce(v_booking.cleaner_payout_cents, 0);
  end if;
  if v_platform_fee_cents is null then
    v_platform_fee_cents := greatest(coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0);
  end if;

  update public.bookings
  set status                          = 'completed',
      payment_status                  = 'released',
      completed_at                    = now(),
      customer_confirmed_completed_at = now(),
      updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.payments (
    booking_id, status, amount_cents, platform_fee_cents, cleaner_payout_cents, currency, captured_at
  ) values (
    p_booking_id, 'released', coalesce(v_booking.quote_cents, 0),
    v_platform_fee_cents, v_cleaner_payout_cents, coalesce(v_booking.currency, 'GBP'), now()
  )
  on conflict (booking_id) do update
    set status               = 'released',
        platform_fee_cents   = excluded.platform_fee_cents,
        cleaner_payout_cents = excluded.cleaner_payout_cents,
        captured_at          = coalesce(public.payments.captured_at, now()),
        updated_at           = now()
  returning id into v_payment_id;

  insert into public.payouts (booking_id, cleaner_id, payment_id, amount_cents, currency, status, released_at)
  values (p_booking_id, v_booking.cleaner_id, v_payment_id, v_cleaner_payout_cents,
          coalesce(v_booking.currency, 'GBP'), 'released', now())
  on conflict (booking_id) do update
    set payment_id  = excluded.payment_id,
        amount_cents = excluded.amount_cents,
        currency     = excluded.currency,
        status       = 'released',
        released_at  = coalesce(public.payouts.released_at, now());

  update public.cleaner_profiles
  set total_earnings_cents = total_earnings_cents + v_cleaner_payout_cents
  where user_id = v_booking.cleaner_id;

  update public.admin_stats
  set total_revenue_cents = total_revenue_cents + v_platform_fee_cents,
      updated_at          = now()
  where id = 1;

  -- Audit: job completed
  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, 'in_progress', 'completed', auth.uid(),
          case when public.is_admin() then 'admin' else 'cleaner' end);

  -- Audit: payout released (system event — tracks financial settlement)
  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, 'completed', 'payout_released', auth.uid(),
          'Cleaner payout: £' || (v_cleaner_payout_cents::numeric / 100)::text
          || ' | Platform: £' || (v_platform_fee_cents::numeric / 100)::text,
          'system');

  -- Notify customer
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'booking_completed', 'Cleaning complete',
          'Your cleaner has completed the job.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  -- Notify cleaner: payout
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.cleaner_id, 'booking_payout_released', 'Payout released',
          'Your earnings for this booking have been released.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'amount_cents', v_cleaner_payout_cents));

  return v_booking;
end;
$$;

-- ── 5. cancel_booking_customer — 24-hour refund rule ─────────

create or replace function public.cancel_booking_customer(
  p_booking_id uuid,
  p_reason     text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_auto_refund boolean;
  v_admin_id    uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status not in ('pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment') then
    raise exception 'Booking cannot be cancelled in its current state (%)', v_booking.status;
  end if;

  -- 24-hour rule: auto-refund if >24h before scheduled start
  v_auto_refund := (v_booking.scheduled_start - now()) > interval '24 hours';

  update public.bookings
  set status              = 'cancelled',
      payment_status      = case when v_auto_refund then 'refunded' else payment_status end,
      cancellation_reason = coalesce(p_reason, 'Customer cancelled'),
      cancelled_at        = now(),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  if v_auto_refund then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id and status != 'refunded';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_booking.status, 'cancelled', auth.uid(),
          coalesce(p_reason, '') ||
          case when v_auto_refund then ' [auto-refund applied]' else ' [admin review required — within 24h]' end,
          'customer');

  -- Notify cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.cleaner_id, 'booking_cancelled', 'Booking cancelled',
          'The customer has cancelled this booking.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason));

  if v_auto_refund then
    -- Notify customer: refund confirmed
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Booking cancelled — refund issued',
            'Your booking has been cancelled and a full refund has been processed.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  else
    -- <24h: flag for admin review
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_cancelled', 'Booking cancelled — awaiting review',
            'Your booking has been cancelled. As it was within 24 hours of the start time, a refund requires admin review.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'booking_cancelled_review', '⚠ Late cancellation — review required',
              'Customer cancelled within 24 hours of booking start. Refund decision needed.',
              p_booking_id, jsonb_build_object('booking_id', p_booking_id,
                'customer_id', v_booking.customer_id, 'reason', p_reason));
    end loop;
  end if;

  return v_booking;
end;
$$;

-- ── 6. cleaner_cannot_attend — cleaner marks unavailability ──

create or replace function public.cleaner_cannot_attend(
  p_booking_id uuid,
  p_reason     text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking       public.bookings;
  v_prev_status   public.booking_status;
  v_admin_id      uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status not in ('pending_request', 'accepted', 'paid') then
    raise exception 'Cannot mark cannot-attend in status %', v_booking.status;
  end if;
  if v_booking.started_at is not null then
    raise exception 'Booking has already been started and cannot be cancelled this way';
  end if;

  v_prev_status := v_booking.status;

  update public.bookings
  set status              = 'cleaner_cancelled',
      cancellation_reason = coalesce(p_reason, 'Cleaner cannot attend'),
      cancelled_at        = now(),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  -- Track cancellation count for quality scoring
  update public.cleaner_profiles
  set cancellation_count = cancellation_count + 1
  where user_id = v_booking.cleaner_id;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_prev_status, 'cleaner_cancelled', auth.uid(),
          coalesce(p_reason, 'Cleaner cannot attend'), 'cleaner');

  -- High-priority admin notifications
  for v_admin_id in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_admin_id, 'cleaner_cancelled', '⚠ Cleaner cannot attend — action required',
            'A cleaner has cancelled. Reassign or refund the customer.',
            p_booking_id,
            jsonb_build_object('booking_id', p_booking_id,
              'cleaner_id', v_booking.cleaner_id,
              'customer_id', v_booking.customer_id,
              'reason', p_reason));
  end loop;

  -- Notify customer
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'cleaner_cancelled', 'Cleaner cannot attend',
          'Your cleaner is unable to attend. We are working to arrange a replacement.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  return v_booking;
end;
$$;

-- ── 7. Update cleaner_has_booking_conflict ───────────────────
-- Exclude cleaner_cancelled from conflict checks so a cleaner
-- who cancels can be re-booked or reassigned for the same slot.

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
  -- Cast status to text so PostgreSQL does not try to resolve the enum literals
  -- at function-creation time (which would fail in the same transaction as
  -- ALTER TYPE ... ADD VALUE 'cleaner_cancelled').
  select exists (
    select 1
    from   public.bookings b
    where  b.cleaner_id      = p_cleaner_id
      and  b.status::text not in (
             'cancelled', 'cleaner_declined', 'declined',
             'refunded', 'cleaner_cancelled'
           )
      and  b.scheduled_start < p_end
      and  b.scheduled_end   > p_start
  );
$$;

grant execute on function public.cleaner_has_booking_conflict(uuid, timestamptz, timestamptz)
  to authenticated;

-- ── 8. RLS on booking_status_events ─────────────────────────
-- Allow participants to see events, admin sees all.
drop policy if exists "Admin reads all booking events" on public.booking_status_events;
create policy "Admin reads all booking events"
on public.booking_status_events for select
using (public.is_admin());

-- ── 9. Availability search: exclude cleaner_cancelled ────────
-- The get_available_cleaners_for_slot function (if it exists) should
-- call cleaner_has_booking_conflict, which now excludes cleaner_cancelled.
-- No additional changes needed here.
