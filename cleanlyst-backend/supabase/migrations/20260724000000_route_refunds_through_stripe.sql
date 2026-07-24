-- =============================================================================
-- CRITICAL FIX (C1): route every refund through the real Stripe implementation
-- =============================================================================
-- Production audit finding: cancel_booking_customer's auto-refund branch and
-- report_cleaner_no_show's refund branch both marked payments.status =
-- 'refunded' directly and (in cancel_booking_customer's case) told the
-- customer "a full refund has been processed" — without ever calling Stripe.
-- The refund-payment Edge Function is the only code that actually calls
-- Stripe and is now the single source of truth for all refunds (see its
-- updated header comment). This migration removes the false DB-only refund
-- marking from both RPCs; the frontend now follows up a successful call to
-- either RPC with a call to refund-payment (via paymentOrchestrator) when a
-- refund is owed, and that Edge Function is solely responsible for
-- payments/bookings refund state going forward.
--
-- Supersedes cancel_booking_customer and report_cleaner_no_show from
-- 20260622300000_unify_booking_status_transitions.sql — no other behaviour
-- changes.
-- =============================================================================

-- ── cancel_booking_customer ──────────────────────────────────────────────────
-- Same as before, minus the direct `payments` write and the "refund has been
-- processed" claim. Still computes and returns the same v_auto_refund
-- decision via cancellation_reason suffix / notification copy so the caller
-- can tell auto-refund-eligible cancellations apart from ones needing admin
-- review, but no longer pretends money has moved.
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

  -- NOTE: this RPC no longer touches public.payments. When v_auto_refund is
  -- true, the caller (bookingLifecycleService.cancelAsCustomer) follows up
  -- with paymentOrchestrator.refundPayment(), which calls Stripe and only
  -- then marks the payment/booking refunded. That call sends its own
  -- "refund processed" notification once Stripe actually confirms — so the
  -- notification below intentionally does NOT claim a refund is complete.
  if v_auto_refund then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_cancelled', 'Booking cancelled — refund in progress',
            'Your booking has been cancelled. Since this was more than 24 hours before the start time, your refund is being processed automatically.',
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

-- ── report_cleaner_no_show ───────────────────────────────────────────────────
-- Same as before, minus the direct `payments` write for the refund action.
-- The caller (whichever composable/page calls this RPC with p_action =
-- 'refund') follows up with paymentOrchestrator.refundPayment() once this
-- RPC returns successfully.
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

  -- NOTE: this RPC no longer touches public.payments for the 'refund'
  -- action. The caller follows up with paymentOrchestrator.refundPayment(),
  -- which calls Stripe and only then marks the payment refunded.

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

grant execute on function public.cancel_booking_customer(uuid, text) to authenticated;
grant execute on function public.report_cleaner_no_show(uuid, text) to authenticated;
