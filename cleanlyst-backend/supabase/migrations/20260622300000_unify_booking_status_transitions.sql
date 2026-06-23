-- =============================================================================
-- UNIFY BOOKING STATUS TRANSITIONS
-- =============================================================================
-- Single source of truth: ONLY transition_booking_state may write
-- bookings.status, bookings.cancellation_reason, and bookings.reassigned_at.
--
-- Enforcement layers:
--   1. trg_guard_booking_status_write (new) — blocks all postgres-role writes
--      unless app.tbs_active session flag is set by transition_booking_state.
--      service_role (Stripe webhook, refund-payment EF) is exempt.
--   2. trg_prevent_booking_field_tampering (existing) — blocks authenticated/anon.
--
-- Functions refactored to call transition_booking_state instead of direct UPDATE:
--   start_booking, complete_booking, cancel_booking_customer,
--   report_cleaner_no_show, cleaner_cannot_attend, reassign_booking,
--   customer_reassign_booking, admin_process_refund
--
-- New transitions added to transition_booking_state state machine:
--   pending_request/accepted/paid → cleaner_cancelled   (cleaner or admin)
--   accepted/paid/cleaner_no_show → cleaner_no_show     (customer or admin, 30min guard)
--   * → accepted                                        (admin reassignment)
--   cleaner_cancelled/cleaner_no_show/reassign_requested → accepted  (customer reassignment)
--   * → refunded                                        (admin, from any non-terminal state)
--
-- New validations in transition_booking_state:
--   payment_authorized → in_progress: 60-min window check
--   in_progress → completed: payment_status in ('captured','authorized')
--   → cleaner_no_show: not already started, 30-min post-start guard

-- ── 1. UPDATED transition_booking_state ──────────────────────────────────────
-- Adds session flag, new transitions, new params (p_reassigned_at, p_notify).
-- Supersedes all prior versions of this function.

drop function if exists public.transition_booking_state(uuid, public.booking_status, text);

create or replace function public.transition_booking_state(
  p_booking_id    uuid,
  p_target_status public.booking_status,
  p_note          text        default null,
  p_reassigned_at timestamptz default null,
  p_notify        boolean     default true
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
  v_admin_id          uuid;
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

  -- ── ACCEPTANCE ───────────────────────────────────────────────────────────────
  -- Cleaner accepts a pending request (includes scheduling conflict guard).
  if v_source_status = 'pending_request' and p_target_status = 'accepted' and v_actor_is_cleaner then
    if exists (
      select 1
      from   public.bookings b
      where  b.cleaner_id      = v_booking.cleaner_id
        and  b.id             != p_booking_id
        and  b.status::text in ('accepted', 'paid', 'in_progress')
        and  b.scheduled_start < v_booking.scheduled_end
        and  b.scheduled_end   > v_booking.scheduled_start
    ) then
      raise exception 'Cleaner is no longer available for this time slot.';
    end if;
    v_is_allowed := true;

  -- Admin accepts a pending request.
  elsif v_source_status = 'pending_request' and p_target_status = 'accepted' and v_actor_is_admin then
    v_is_allowed := true;

  -- Admin or customer reassignment: any reassignable state → accepted.
  -- Used by reassign_booking (admin) and customer_reassign_booking (customer).
  elsif p_target_status = 'accepted'
    and v_source_status::text in (
      'cleaner_no_show', 'accepted', 'in_progress', 'pending_request',
      'cleaner_cancelled', 'reassign_requested', 'paid'
    )
    and v_actor_is_admin
  then
    v_is_allowed := true;

  elsif p_target_status = 'accepted'
    and v_source_status::text in ('cleaner_cancelled', 'cleaner_no_show', 'reassign_requested')
    and v_actor_is_customer
  then
    v_is_allowed := true;

  -- ── PAID (auto-advance trigger; also direct admin) ────────────────────────
  elsif v_source_status = 'accepted' and p_target_status = 'paid' and v_actor_is_admin then
    v_is_allowed := true;

  -- ── IN PROGRESS ───────────────────────────────────────────────────────────
  elsif v_source_status in ('paid', 'accepted')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'payment_authorized'
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    -- Stripe capture_method: manual — payment is held but not yet captured.
    -- The hold guarantees funds; allow start without captured check.
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status in ('paid_pending_start', 'scheduled')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── COMPLETED ─────────────────────────────────────────────────────────────
  elsif v_source_status = 'in_progress' and p_target_status = 'completed'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.payment_status not in ('captured', 'authorized') then
      raise exception
        'Cannot complete booking: payment not received (current: %)', v_booking.payment_status;
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'completion_pending_customer'
    and p_target_status = 'completed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── COMPLETION PENDING CUSTOMER ───────────────────────────────────────────
  elsif v_source_status = 'in_progress'
    and p_target_status = 'completion_pending_customer'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── DISPUTED ──────────────────────────────────────────────────────────────
  elsif v_source_status in ('completed', 'completion_pending_customer')
    and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  elsif v_source_status = 'in_progress' and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── DECLINED ──────────────────────────────────────────────────────────────
  elsif v_source_status = 'pending_request'
    and p_target_status in ('declined', 'cleaner_declined')
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── CANCELLED (customer or admin) ─────────────────────────────────────────
  elsif v_source_status::text in (
      'pending_request', 'accepted', 'paid',
      'estimate_proposed', 'awaiting_customer_payment'
    )
    and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  elsif v_source_status::text in ('accepted', 'paid', 'cleaner_no_show')
    and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── CLEANER CANCELLED ─────────────────────────────────────────────────────
  elsif v_source_status::text in ('pending_request', 'accepted', 'paid')
    and p_target_status = 'cleaner_cancelled'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.started_at is not null then
      raise exception 'Booking has already started and cannot be cancelled this way';
    end if;
    v_is_allowed := true;

  -- ── CLEANER NO SHOW ───────────────────────────────────────────────────────
  elsif v_source_status::text in ('accepted', 'paid', 'cleaner_no_show')
    and p_target_status = 'cleaner_no_show'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    if v_booking.started_at is not null then
      raise exception 'This booking has already been started';
    end if;
    if now() <= v_booking.scheduled_start + interval '30 minutes' then
      raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
    end if;
    v_is_allowed := true;

  -- ── REFUNDED ──────────────────────────────────────────────────────────────
  -- Admin can refund from any non-terminal state.
  -- Stripe webhook writes refunded via service_role (bypasses this RPC).
  elsif p_target_status = 'refunded'
    and v_actor_is_admin
    and v_source_status::text not in ('refunded', 'declined', 'cleaner_declined')
  then
    v_is_allowed := true;

  -- ── ESTIMATE FLOW ─────────────────────────────────────────────────────────
  elsif v_source_status = 'pending_request'
    and p_target_status = 'estimate_proposed'
    and v_actor_is_cleaner
  then
    v_is_allowed := true;

  elsif v_source_status = 'estimate_proposed'
    and p_target_status = 'awaiting_customer_payment'
    and v_actor_is_customer
  then
    v_is_allowed := true;

  elsif v_source_status = 'awaiting_customer_payment'
    and p_target_status = 'payment_authorized'
    and v_actor_is_customer
  then
    v_is_allowed := true;

  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition: % → % (actor: %)',
      v_source_status, p_target_status, v_actor_role;
  end if;

  -- ── Authorize postgres-role writes via session flag ───────────────────────
  -- The trigger trg_guard_booking_status_write rejects direct writes to
  -- status/cancellation_reason/reassigned_at unless this flag is set.
  -- set_config(..., true) makes the setting local to the current transaction.
  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set
    status          = p_target_status,
    decline_reason  = case
                        when p_target_status in ('declined', 'cleaner_declined')
                        then coalesce(p_note, decline_reason)
                        else decline_reason
                      end,
    accepted_at     = case
                        when p_target_status in ('accepted', 'paid') and accepted_at is null
                        then now()
                        else accepted_at
                      end,
    started_at      = case
                        when p_target_status = 'in_progress' then now()
                        else started_at
                      end,
    completed_at    = case
                        when p_target_status = 'completed' then now()
                        else completed_at
                      end,
    customer_confirmed_completed_at = case
                        when p_target_status = 'completed' then now()
                        else customer_confirmed_completed_at
                      end,
    dispute_opened_at  = case
                        when p_target_status = 'disputed' then now()
                        else dispute_opened_at
                      end,
    dispute_resolved_at = case
                        when p_target_status in ('completed', 'refunded')
                          and v_source_status = 'disputed'
                        then now()
                        else dispute_resolved_at
                      end,
    cancelled_at    = case
                        when p_target_status in ('cancelled', 'cleaner_cancelled') then now()
                        else cancelled_at
                      end,
    cancellation_reason = case
                        when p_target_status in ('cancelled', 'cleaner_cancelled')
                        then coalesce(p_note, cancellation_reason)
                        else cancellation_reason
                      end,
    reassigned_at   = case
                        when p_reassigned_at is not null then p_reassigned_at
                        else reassigned_at
                      end,
    updated_at      = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_source_status, p_target_status, auth.uid(), p_note, v_actor_role);

  -- ── Auto-advance accepted → paid when payment already captured ────────────
  -- Session flag is still set (local to this transaction), so the trigger allows it.
  if p_target_status = 'accepted' and v_booking.payment_status = 'captured' then
    update public.bookings
    set status = 'paid', updated_at = now()
    where id = p_booking_id
    returning * into v_booking;

    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (p_booking_id, 'accepted', 'paid', auth.uid(),
            'Auto-advanced: payment already captured', 'system');
  end if;

  -- ── Dispute record ────────────────────────────────────────────────────────
  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id,
            auth.uid(), coalesce(p_note, 'Dispute opened'))
    on conflict (booking_id) do nothing;
  end if;

  -- ── Notifications (skipped when caller handles its own) ───────────────────
  if not p_notify then
    return v_booking;
  end if;

  if p_target_status in ('accepted', 'paid') then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_accepted', 'Booking confirmed',
            'Your cleaner has accepted the booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id))
    on conflict do nothing;

  elsif p_target_status in ('declined', 'cleaner_declined') then
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

  elsif p_target_status = 'cleaner_cancelled' then
    -- Notify customer and all admins.
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'cleaner_cancelled', 'Cleaner cannot attend',
            'Your cleaner is unable to attend. We are working to arrange a replacement.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'cleaner_cancelled', '⚠ Cleaner cannot attend — action required',
              'A cleaner has cancelled. Reassign or refund the customer.',
              p_booking_id, jsonb_build_object(
                'booking_id', p_booking_id,
                'cleaner_id', v_booking.cleaner_id,
                'customer_id', v_booking.customer_id,
                'reason', p_note));
    end loop;

  elsif p_target_status = 'cleaner_no_show' then
    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'cleaner_no_show', 'Cleaner did not attend booking',
              coalesce(
                case when p_note = 'replacement_requested' then 'Customer requested another cleaner.'
                     when p_note = 'refund_requested'       then 'Customer requested a refund.'
                     else null end,
                'No-show reported.'),
              p_booking_id, jsonb_build_object(
                'booking_id',  p_booking_id,
                'cleaner_id',  v_booking.cleaner_id,
                'customer_id', v_booking.customer_id,
                'action',      p_note));
    end loop;

  elsif p_target_status = 'disputed' then
    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'booking_disputed', 'Dispute opened',
              'A customer has raised a dispute on a completed booking.',
              p_booking_id, jsonb_build_object('booking_id', p_booking_id));
    end loop;

  elsif p_target_status = 'refunded' then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Refund issued',
            'A refund has been issued for your booking.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  end if;

  return v_booking;
end;
$$;

grant execute on function public.transition_booking_state(
  uuid, public.booking_status, text, timestamptz, boolean
) to authenticated;


-- ── 2. UPDATED start_booking — delegates status write to transition_booking_state ──
-- Supersedes 20260622100000.
-- start_booking retains: auth check, idempotency guard.
-- transition_booking_state handles: 60-min window, payment check, UPDATE, audit, notification.

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
  -- Idempotency: already started → return current state without re-transitioning.
  if v_booking.started_at is not null then
    return v_booking;
  end if;

  -- Delegate to transition_booking_state (handles 60-min window, payment check,
  -- status write, audit event, and customer notification).
  return public.transition_booking_state(p_booking_id, 'in_progress');
end;
$$;

grant execute on function public.start_booking(uuid) to authenticated;


-- ── 3. UPDATED complete_booking — delegates status write to transition_booking_state ──
-- Supersedes 20260622200000.
-- complete_booking retains: auth, payout/payment financial logic, payout audit event,
--   cleaner payout notification.
-- transition_booking_state handles: payment_status guard, UPDATE, in_progress→completed
--   audit event, customer booking_completed notification.

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

  -- Delegate status change to transition_booking_state.
  -- tbs validates payment_status, writes status = 'completed', inserts audit event,
  -- and sends booking_completed notification to the customer.
  v_booking := public.transition_booking_state(p_booking_id, 'completed');

  -- ── Financial logic (not in transition_booking_state scope) ──────────────
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
    v_platform_fee_cents := greatest(
      coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0);
  end if;

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
    set payment_id   = excluded.payment_id,
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

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, 'completed', 'payout_released', auth.uid(),
          'Cleaner payout: £' || (v_cleaner_payout_cents::numeric / 100)::text
          || ' | Platform: £' || (v_platform_fee_cents::numeric / 100)::text,
          'system');

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.cleaner_id, 'booking_payout_released', 'Payout released',
          'Your earnings for this booking have been released.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'amount_cents', v_cleaner_payout_cents));

  return v_booking;
end;
$$;

grant execute on function public.complete_booking(uuid) to authenticated;


-- ── 4. UPDATED cancel_booking_customer — delegates status write to transition_booking_state ──
-- Supersedes 20260622200000.
-- cancel_booking_customer retains: auth, allowlist guard, 24-hr auto-refund, customer/admin notifications.
-- transition_booking_state handles: status='cancelled', cancellation_reason, cancelled_at,
--   audit event, and generic cleaner notification.
-- Note: payment_authorized path handled by refund-payment EF → removed from allowlist here.

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
  -- payment_authorized cancellation is handled by the refund-payment EF
  -- (which cancels the uncaptured Stripe PI then lets the webhook set status).
  if v_booking.status::text not in (
    'pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment'
  ) then
    raise exception 'Booking cannot be cancelled in its current state (%)', v_booking.status;
  end if;

  v_auto_refund := (v_booking.scheduled_start - now()) > interval '24 hours';

  -- Delegate to tbs: writes status='cancelled', cancellation_reason, cancelled_at,
  -- audit event, and generic cleaner cancel notification.
  v_booking := public.transition_booking_state(
    p_booking_id, 'cancelled',
    coalesce(p_reason, 'Customer cancelled') ||
    case when v_auto_refund then ' [auto-refund applied]' else ' [admin review required — within 24h]' end
  );

  -- Auto-refund: mark payment row as refunded (DB-side; Stripe refund is separate).
  if v_auto_refund then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id and status != 'refunded';
  end if;

  -- Customer-facing notification (context-specific, different from generic cleaner cancel above).
  if v_auto_refund then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Booking cancelled — refund issued',
            'Your booking has been cancelled and a full refund has been processed.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  else
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_cancelled', 'Booking cancelled — awaiting review',
            'Your booking has been cancelled. As it was within 24 hours of the start time, a refund requires admin review.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'booking_cancelled_review', '⚠ Late cancellation — review required',
              'Customer cancelled within 24 hours of booking start. Refund decision needed.',
              p_booking_id, jsonb_build_object(
                'booking_id', p_booking_id,
                'customer_id', v_booking.customer_id,
                'reason', p_reason));
    end loop;
  end if;

  return v_booking;
end;
$$;

grant execute on function public.cancel_booking_customer(uuid, text) to authenticated;


-- ── 5. UPDATED report_cleaner_no_show — delegates status write to transition_booking_state ──
-- Supersedes 20260622200000.
-- report_cleaner_no_show retains: auth, validation, payment update for refund action.
-- transition_booking_state handles: status write, cancellation_reason, audit event, admin notification.
-- Non-guarded fields (no_show_action, no_show_reported_at) are set via a separate UPDATE.
-- p_notify=false: tbs admin notification uses p_note to generate action-specific body.

create or replace function public.report_cleaner_no_show(
  p_booking_id uuid,
  p_action     text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking        public.bookings;
  v_target_status  public.booking_status;
  v_no_show_action text;
  v_note           text;
begin
  if p_action not in ('replacement', 'refund') then
    raise exception 'Invalid no-show action: %', p_action;
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.started_at is not null then
    raise exception 'This booking has already been started';
  end if;
  if v_booking.status = 'completed' then
    raise exception 'Completed bookings cannot be reported as no-show';
  end if;
  if v_booking.status::text not in ('accepted', 'paid', 'cleaner_no_show') then
    raise exception 'Only accepted or paid bookings can be reported as no-show (current: %)', v_booking.status;
  end if;
  if now() <= v_booking.scheduled_start + interval '30 minutes' then
    raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
  end if;
  if v_booking.no_show_action is not null then
    return v_booking;
  end if;

  if p_action = 'replacement' then
    v_target_status  := 'cleaner_no_show';
    v_no_show_action := 'replacement_requested';
    v_note           := 'replacement_requested';
  else
    v_target_status  := 'cancelled';
    v_no_show_action := 'refund_requested';
    v_note           := 'cleaner_no_show'; -- used as cancellation_reason by tbs
  end if;

  -- Delegate status change to transition_booking_state.
  -- For 'cancelled', tbs sets cancellation_reason = v_note = 'cleaner_no_show'.
  -- For 'cleaner_no_show', tbs sends admin notification with action-specific body.
  v_booking := public.transition_booking_state(p_booking_id, v_target_status, v_note);

  -- Mark payment as refunded for refund action (DB-side record; Stripe handles real transfer).
  if p_action = 'refund' then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id and status <> 'refunded';
  end if;

  -- Set no_show fields (not guarded by status trigger — tamper trigger allows postgres).
  update public.bookings
  set no_show_action      = v_no_show_action,
      no_show_reported_at = now(),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.report_cleaner_no_show(uuid, text) to authenticated;


-- ── 6. UPDATED cleaner_cannot_attend — delegates status write to transition_booking_state ──
-- Supersedes 20260602400000.
-- cleaner_cannot_attend retains: auth, status guard, cancellation_count update.
-- transition_booking_state handles: status='cleaner_cancelled', cancellation_reason,
--   cancelled_at, audit event, customer + admin notifications.

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
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status::text not in ('pending_request', 'accepted', 'paid') then
    raise exception 'Cannot mark cannot-attend in status %', v_booking.status;
  end if;
  -- Note: started_at check is enforced inside transition_booking_state.

  -- Delegate to tbs: writes cleaner_cancelled, sets cancellation_reason, sends notifications.
  v_booking := public.transition_booking_state(
    p_booking_id, 'cleaner_cancelled', coalesce(p_reason, 'Cleaner cannot attend')
  );

  -- Track cancellation count for quality scoring (not a status-write, not guarded).
  update public.cleaner_profiles
  set cancellation_count = cancellation_count + 1
  where user_id = v_booking.cleaner_id;

  return v_booking;
end;
$$;

grant execute on function public.cleaner_cannot_attend(uuid, text) to authenticated;


-- ── 7. UPDATED reassign_booking — delegates status+reassigned_at to transition_booking_state ──
-- Supersedes 20260618100000.
-- reassign_booking retains: admin guard, allowlist check, cleaner/schedule field updates, notifications.
-- transition_booking_state handles: status='accepted', reassigned_at, audit event.
-- Non-guarded fields (cleaner_id, original_cleaner_id, scheduled_start, etc.) are set separately.

drop function if exists public.reassign_booking(uuid, uuid, text);

create or replace function public.reassign_booking(
  p_booking_id           uuid,
  p_new_cleaner_id       uuid,
  p_note                 text        default null,
  p_new_scheduled_start  timestamptz default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking        public.bookings;
  v_old_cleaner_id uuid;
  v_customer_id    uuid;
  v_new_end        timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reassign bookings';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.status::text not in (
    'cleaner_no_show', 'accepted', 'in_progress', 'pending_request',
    'cleaner_cancelled', 'reassign_requested', 'paid'
  ) then
    raise exception 'Booking cannot be reassigned in status: %', v_booking.status;
  end if;

  v_old_cleaner_id := v_booking.cleaner_id;
  v_customer_id    := v_booking.customer_id;

  if p_new_scheduled_start is not null then
    v_new_end := p_new_scheduled_start + (v_booking.scheduled_end - v_booking.scheduled_start);
  end if;

  -- Delegate status and reassigned_at to transition_booking_state.
  -- p_notify=false: reassign_booking sends its own domain-specific notifications.
  v_booking := public.transition_booking_state(
    p_booking_id, 'accepted',
    coalesce(p_note, 'Booking reassigned by admin'),
    now(),   -- p_reassigned_at
    false    -- p_notify — notifications sent below
  );

  -- Update non-guarded fields (cleaner assignment, schedule, timestamps).
  update public.bookings
  set cleaner_id          = p_new_cleaner_id,
      original_cleaner_id = coalesce(original_cleaner_id, v_old_cleaner_id),
      reassigned_by       = auth.uid(),
      accepted_at         = now(),
      started_at          = null,
      completed_at        = null,
      scheduled_start     = coalesce(p_new_scheduled_start, scheduled_start),
      scheduled_end       = coalesce(v_new_end, scheduled_end),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (p_new_cleaner_id, 'booking_reassigned', 'You have been assigned a booking',
          'You have been assigned a booking.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'customer_id', v_customer_id));

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_customer_id, 'booking_reassigned', 'Replacement cleaner assigned',
          'A replacement cleaner has been assigned to your booking.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', p_new_cleaner_id));

  if v_old_cleaner_id is not null and v_old_cleaner_id != p_new_cleaner_id then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_old_cleaner_id, 'booking_reassigned', 'Booking reassigned',
            'This booking has been reassigned to another cleaner.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  end if;

  return v_booking;
end;
$$;

grant execute on function public.reassign_booking(uuid, uuid, text, timestamptz) to authenticated;


-- ── 8. UPDATED customer_reassign_booking — delegates status+reassigned_at to tbs ──
-- Supersedes 20260621600000.

create or replace function public.customer_reassign_booking(
  p_booking_id           uuid,
  p_new_cleaner_id       uuid,
  p_new_scheduled_start  timestamptz default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_old_cleaner uuid;
  v_new_end     timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status::text not in ('cleaner_cancelled', 'cleaner_no_show', 'reassign_requested') then
    raise exception
      'Replacement can only be chosen after cleaner cancellation or no-show (current: %)',
      v_booking.status;
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.cleaner_profiles cp on cp.user_id = p.id
    where p.id = p_new_cleaner_id
      and p.role = 'cleaner_active'
      and cp.status = 'approved'
  ) then
    raise exception 'The selected cleaner is not available for bookings';
  end if;

  v_old_cleaner := v_booking.cleaner_id;

  if p_new_scheduled_start is not null then
    v_new_end := p_new_scheduled_start + (v_booking.scheduled_end - v_booking.scheduled_start);
  end if;

  -- Delegate status and reassigned_at to transition_booking_state.
  -- p_notify=false: this function sends its own notifications.
  v_booking := public.transition_booking_state(
    p_booking_id, 'accepted',
    'Customer selected replacement cleaner',
    now(),   -- p_reassigned_at
    false    -- p_notify
  );

  -- Update non-guarded fields.
  update public.bookings
  set cleaner_id          = p_new_cleaner_id,
      original_cleaner_id = coalesce(original_cleaner_id, v_old_cleaner),
      accepted_at         = now(),
      started_at          = null,
      completed_at        = null,
      scheduled_start     = coalesce(p_new_scheduled_start, scheduled_start),
      scheduled_end       = coalesce(v_new_end, scheduled_end),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (p_new_cleaner_id, 'booking_reassigned', 'You have been assigned a booking',
          'A customer has selected you as their replacement cleaner.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'customer_id', v_booking.customer_id));

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'booking_reassigned', 'Replacement cleaner confirmed',
          'Your replacement cleaner has been confirmed.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', p_new_cleaner_id));

  if v_old_cleaner is not null and v_old_cleaner != p_new_cleaner_id then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_old_cleaner, 'booking_reassigned', 'Booking reassigned',
            'Your booking has been assigned to a new cleaner by the customer.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  end if;

  return v_booking;
end;
$$;

grant execute on function public.customer_reassign_booking(uuid, uuid, timestamptz) to authenticated;


-- ── 9. UPDATED admin_process_refund — delegates full-refund status to transition_booking_state ──
-- Supersedes 20260621300000.
-- For full refunds: calls tbs(refunded, p_notify=false) for the status change + audit event,
--   then sends its own detailed refund notifications.
-- For partial refunds: no status change — payments + notifications only (unchanged).

create or replace function public.admin_process_refund(
  p_booking_id    uuid,
  p_refund_cents  integer,
  p_reason        text,
  p_notes         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment        public.payments;
  v_booking        public.bookings;
  v_is_full        boolean;
  v_customer_id    uuid;
  v_cleaner_id     uuid;
  v_customer_name  text;
  v_service_title  text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can process refunds';
  end if;
  if p_refund_cents < 0 then
    raise exception 'Refund amount cannot be negative';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Refund reason is required';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then raise exception 'Booking not found'; end if;

  select * into v_payment from public.payments where booking_id = p_booking_id;
  if v_payment.id is null then raise exception 'No payment record found for this booking'; end if;

  if v_payment.status not in ('captured', 'released', 'paid') then
    raise exception 'Payment cannot be refunded in status: %', v_payment.status;
  end if;
  if p_refund_cents > v_payment.amount_cents then
    raise exception 'Refund amount (%) exceeds payment amount (%)', p_refund_cents, v_payment.amount_cents;
  end if;

  if exists (
    select 1 from public.payouts
    where booking_id = p_booking_id and stripe_transfer_id is not null
  ) then
    raise exception
      'Cannot issue DB refund: cleaner payout has already been transferred to Stripe. '
      'Use the Stripe dashboard to reverse the transfer (payouts.stripe_transfer_id), '
      'then contact engineering to clear the transfer record before re-issuing this refund.';
  end if;

  v_is_full       := p_refund_cents = v_payment.amount_cents;
  v_customer_id   := v_booking.customer_id;
  v_cleaner_id    := v_booking.cleaner_id;
  v_service_title := coalesce(v_booking.service_title_snapshot, 'Cleaning Booking');

  select full_name into v_customer_name from public.profiles where id = v_customer_id;

  update public.payments
  set status        = 'refunded',
      refund_cents  = p_refund_cents,
      refund_reason = p_reason,
      refund_notes  = p_notes,
      refunded_by   = auth.uid(),
      refunded_at   = now(),
      updated_at    = now()
  where id = v_payment.id;

  if v_is_full then
    -- Delegate status change to transition_booking_state.
    -- p_notify=false: we send detailed refund notifications below (not the generic booking_refunded).
    perform public.transition_booking_state(
      p_booking_id, 'refunded',
      'Admin processed full refund: ' || p_reason,
      null,   -- p_reassigned_at
      false   -- p_notify — send own notifications below
    );
  else
    -- Partial refund — no status change. Log audit event only.
    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (p_booking_id, v_booking.status, v_booking.status, auth.uid(),
            'Admin processed partial refund of £' || (p_refund_cents::numeric / 100)::text || ': ' || p_reason,
            'admin');
  end if;

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_customer_id, 'refund_processed',
    case when v_is_full then 'Full refund issued' else 'Partial refund issued' end,
    'A ' || case when v_is_full then 'full' else 'partial' end ||
      ' refund of £' || (p_refund_cents::numeric / 100)::text ||
      ' has been processed for your booking (' || v_service_title || ').',
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'refund_cents', p_refund_cents,
                       'reason', p_reason, 'is_full', v_is_full)
  );

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_cleaner_id, 'refund_processed', 'Refund issued on your booking',
    'A refund of £' || (p_refund_cents::numeric / 100)::text ||
      ' has been issued for booking ' || v_service_title || '. Reason: ' || p_reason,
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'refund_cents', p_refund_cents,
                       'reason', p_reason, 'is_full', v_is_full)
  );

  return jsonb_build_object(
    'booking_id',     p_booking_id,
    'refund_cents',   p_refund_cents,
    'is_full',        v_is_full,
    'payment_total',  v_payment.amount_cents,
    'platform_fee',   coalesce(v_payment.platform_fee_cents, 0),
    'cleaner_payout', coalesce(v_payment.cleaner_payout_cents, 0)
  );
end;
$$;

grant execute on function public.admin_process_refund(uuid, integer, text, text) to authenticated;


-- ── 10. DB TRIGGER: guard_booking_status_write ────────────────────────────────
-- BEFORE UPDATE on bookings — fires when status, cancellation_reason, or
-- reassigned_at changes.
--
-- Allow list:
--   service_role / supabase_admin — Stripe webhook and authorized Edge Functions
--   postgres + app.tbs_active flag — SECURITY DEFINER RPCs called via transition_booking_state
--
-- All other callers (authenticated, anon, postgres without flag) are rejected.
-- This is an additional layer on top of trg_prevent_booking_field_tampering,
-- which already blocks authenticated/anon for all guarded fields.

create or replace function public.guard_booking_status_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Stripe webhook and authorized Edge Functions run as service_role.
  if current_user in ('service_role', 'supabase_admin') then
    return new;
  end if;

  -- SECURITY DEFINER RPCs run as postgres.
  -- Only allowed when transition_booking_state has set the session flag.
  if current_user = 'postgres'
     and current_setting('app.tbs_active', true) = 'true'
  then
    return new;
  end if;

  raise exception
    'Direct writes to bookings.status/cancellation_reason/reassigned_at are forbidden. '
    'Use the transition_booking_state RPC. '
    '(caller role: %, tbs_active: %)',
    current_user,
    coalesce(current_setting('app.tbs_active', true), 'unset');
end;
$$;

create trigger trg_guard_booking_status_write
before update on public.bookings
for each row
when (
  old.status             is distinct from new.status
  or old.cancellation_reason is distinct from new.cancellation_reason
  or old.reassigned_at   is distinct from new.reassigned_at
)
execute function public.guard_booking_status_write();

revoke execute on function public.guard_booking_status_write() from public;
revoke execute on function public.guard_booking_status_write() from anon;
