-- =============================================================================
-- FIX: admin_process_refund — invalid enum value 'paid' in payment status check
-- =============================================================================
-- Migration 20260623000000 introduced a check:
--   if v_payment.status not in ('captured', 'released', 'paid') then
-- The payment_status enum does not include 'paid' as a valid value (only:
--   unpaid | authorized | captured | refunded | failed | released).
-- PostgreSQL casts every literal in the IN list to payment_status when
-- v_payment.status is an enum column, so the cast of 'paid' throws:
--   invalid input value for enum payment_status: "paid"
-- This causes every call to admin_process_refund to raise an exception before
-- reaching the refund logic — both full and partial refunds are blocked.
--
-- Fix: remove 'paid' from the IN list.
-- Supersedes admin_process_refund from 20260623000000.

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

  -- Load booking
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  -- Load payment
  select * into v_payment from public.payments where booking_id = p_booking_id;
  if v_payment.id is null then
    raise exception 'No payment record found for this booking';
  end if;

  -- 'paid' is not a valid payment_status enum value; check only valid refundable states.
  if v_payment.status not in ('captured', 'released') then
    raise exception 'Payment cannot be refunded in status: %', v_payment.status;
  end if;

  if p_refund_cents > v_payment.amount_cents then
    raise exception 'Refund amount (%) exceeds payment amount (%)',
      p_refund_cents, v_payment.amount_cents;
  end if;

  -- Guard: reject if cleaner payout has already been physically transferred to Stripe.
  if exists (
    select 1
    from public.payouts
    where booking_id = p_booking_id
      and stripe_transfer_id is not null
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

  select full_name into v_customer_name
  from public.profiles where id = v_customer_id;

  -- Update payment record
  update public.payments
  set
    status        = 'refunded',
    refund_cents  = p_refund_cents,
    refund_reason = p_reason,
    refund_notes  = p_notes,
    refunded_by   = auth.uid(),
    refunded_at   = now(),
    updated_at    = now()
  where id = v_payment.id;

  -- Update booking status and write audit event.
  -- Authorize the postgres-role write to bookings.status through the
  -- guard_booking_status_write trigger (requires app.tbs_active = 'true').
  perform set_config('app.tbs_active', 'true', true);

  if v_is_full then
    update public.bookings
    set status     = 'refunded',
        updated_at = now()
    where id = p_booking_id;

    insert into public.booking_status_events (
      booking_id, from_status, to_status, actor_id, notes, actor_role
    ) values (
      p_booking_id, v_booking.status, 'refunded',
      auth.uid(), 'Admin processed full refund: ' || p_reason, 'admin'
    );
  else
    insert into public.booking_status_events (
      booking_id, from_status, to_status, actor_id, notes, actor_role
    ) values (
      p_booking_id, v_booking.status, v_booking.status,
      auth.uid(), 'Admin processed partial refund of ' ||
        (p_refund_cents::numeric / 100)::text || ': ' || p_reason,
      'admin'
    );
  end if;

  -- Notify customer
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_customer_id,
    'refund_processed',
    case when v_is_full then 'Full refund issued' else 'Partial refund issued' end,
    'A ' || case when v_is_full then 'full' else 'partial' end ||
      ' refund of £' || (p_refund_cents::numeric / 100)::text ||
      ' has been processed for your booking (' || v_service_title || ').',
    p_booking_id,
    jsonb_build_object(
      'booking_id',   p_booking_id,
      'refund_cents', p_refund_cents,
      'reason',       p_reason,
      'is_full',      v_is_full
    )
  );

  -- Notify cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_cleaner_id,
    'refund_processed',
    'Refund issued on your booking',
    'A refund of £' || (p_refund_cents::numeric / 100)::text ||
      ' has been issued for booking ' || v_service_title ||
      '. Reason: ' || p_reason,
    p_booking_id,
    jsonb_build_object(
      'booking_id',   p_booking_id,
      'refund_cents', p_refund_cents,
      'reason',       p_reason,
      'is_full',      v_is_full
    )
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
