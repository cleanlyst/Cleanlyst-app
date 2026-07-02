-- =============================================================================
-- PHASE F2: Estimate Adjustment Redesign
-- =============================================================================
-- Redesigns the estimate workflow for the Pay-Before-Accept marketplace.
--
-- Problem:
--   The old estimate flow (pending_request → estimate_proposed) required cleaners
--   to see unpaid bookings. RLS now correctly blocks this. The flow is broken.
--
-- New flow:
--   payment_authorized            ← cleaner reviews a paid booking
--     → estimate_adjustment_requested   ← cleaner requests price change
--       → payment_authorized            ← customer accepts + pays diff (Stripe)
--       → payment_authorized            ← customer accepts, no charge (diff ≤ 0)
--       → reassign_requested            ← customer rejects + wants new cleaner
--       → cancelled                     ← customer rejects + wants refund
--
-- Financial model:
--   - Original PaymentIntent remains authorized throughout
--   - If adjustment_amount_cents > 0: separate Stripe Checkout for the difference
--     Webhook emits ADDITIONAL_PAYMENT_AUTHORIZED → transitions to payment_authorized
--   - If adjustment_amount_cents ≤ 0: no Stripe; RPC transitions directly
--     Refund of discount processed by admin after capture
--
-- New ledger event types:
--   ESTIMATE_ADJUSTMENT_REQUESTED  — cleaner requests price change (synthetic)
--   ESTIMATE_ADJUSTMENT_ACCEPTED   — customer accepts (synthetic)
--   ESTIMATE_ADJUSTMENT_REJECTED   — customer rejects (synthetic)
--   ADDITIONAL_PAYMENT_AUTHORIZED  — Stripe confirms adjustment payment
-- =============================================================================


-- ── 1. Add new booking status ─────────────────────────────────────────────────

alter type public.booking_status add value if not exists 'estimate_adjustment_requested';


-- ── 2. New columns on bookings ────────────────────────────────────────────────

alter table public.bookings
  add column if not exists proposed_total_cents              integer,
  add column if not exists adjustment_amount_cents           integer,
  add column if not exists adjustment_reason                 text,
  add column if not exists adjustment_requested_at           timestamptz,
  add column if not exists adjustment_requested_by           uuid references public.profiles(id),
  add column if not exists customer_adjustment_response_at   timestamptz;

-- Positive-total guard (NULL allowed = no active adjustment)
alter table public.bookings
  drop constraint if exists chk_proposed_total_positive;
alter table public.bookings
  add constraint chk_proposed_total_positive
  check (proposed_total_cents is null or proposed_total_cents > 0);

comment on column public.bookings.proposed_total_cents is
  'Cleaner-proposed total for the job. Set during estimate_adjustment_requested.';
comment on column public.bookings.adjustment_amount_cents is
  'Difference between proposed_total_cents and original quote_cents. Can be negative.';
comment on column public.bookings.adjustment_reason is
  'Cleaner''s written explanation for the price adjustment request.';
comment on column public.bookings.adjustment_requested_at is
  'When the cleaner submitted the price adjustment request.';
comment on column public.bookings.adjustment_requested_by is
  'Profile ID of the cleaner who requested the adjustment.';
comment on column public.bookings.customer_adjustment_response_at is
  'When the customer responded (accepted or rejected) to the adjustment.';


-- ── 3. Expand ledger event type constraint ────────────────────────────────────

alter table public.payment_ledger_events
  drop constraint if exists payment_ledger_events_event_type_check;

alter table public.payment_ledger_events
  add constraint payment_ledger_events_event_type_check
  check (event_type in (
    'PAYMENT_AUTHORIZED',
    'PAYMENT_CAPTURED',
    'PAYMENT_REFUNDED',
    'PAYOUT_RELEASED',
    'PAYOUT_REVERSED',
    'ESTIMATE_ADJUSTMENT_REQUESTED',
    'ESTIMATE_ADJUSTMENT_ACCEPTED',
    'ESTIMATE_ADJUSTMENT_REJECTED',
    'ADDITIONAL_PAYMENT_AUTHORIZED'
  ));


-- ── 4. request_price_adjustment RPC ──────────────────────────────────────────
-- Cleaner calls this from payment_authorized to request a price change.
-- Sets adjustment fields, transitions to estimate_adjustment_requested,
-- emits ESTIMATE_ADJUSTMENT_REQUESTED ledger event, notifies customer.

create or replace function public.request_price_adjustment(
  p_booking_id           uuid,
  p_proposed_total_cents integer,
  p_reason               text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking   public.bookings;
  v_adj_cents integer;
  v_from_status public.booking_status;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  -- Auth: only the assigned cleaner
  if v_booking.cleaner_id is distinct from auth.uid() then
    raise exception 'Only the assigned cleaner may request a price adjustment';
  end if;

  -- Source state: payment_authorized or accepted
  if v_booking.status not in ('payment_authorized', 'accepted') then
    raise exception
      'Price adjustment can only be requested from payment_authorized or accepted '
      '(current: %)', v_booking.status;
  end if;

  -- Validated inputs
  if p_proposed_total_cents is null or p_proposed_total_cents <= 0 then
    raise exception 'proposed_total_cents must be a positive integer';
  end if;

  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'A reason of at least 10 characters is required';
  end if;

  v_from_status := v_booking.status;
  v_adj_cents   := p_proposed_total_cents - coalesce(v_booking.quote_cents, 0);

  -- Bypass the booking status write guard (runs as postgres in SECURITY DEFINER)
  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set
    status                          = 'estimate_adjustment_requested',
    proposed_total_cents            = p_proposed_total_cents,
    adjustment_amount_cents         = v_adj_cents,
    adjustment_reason               = p_reason,
    adjustment_requested_at         = now(),
    adjustment_requested_by         = auth.uid(),
    customer_adjustment_response_at = null,
    updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events
    (booking_id, from_status, to_status, actor_id, actor_role, notes)
  values (
    p_booking_id,
    v_from_status,
    'estimate_adjustment_requested',
    auth.uid(),
    'cleaner',
    p_reason
  );

  -- Synthetic ledger event (non-Stripe, idempotency key includes timestamp)
  insert into public.payment_ledger_events (
    booking_id, event_type, amount_cents, currency, stripe_event_id, metadata
  ) values (
    p_booking_id,
    'ESTIMATE_ADJUSTMENT_REQUESTED',
    p_proposed_total_cents,
    coalesce(v_booking.currency, 'gbp'),
    'synthetic_adj_req_' || p_booking_id::text || '_' || extract(epoch from now())::bigint::text,
    jsonb_build_object(
      'original_quote_cents',     v_booking.quote_cents,
      'proposed_total_cents',     p_proposed_total_cents,
      'adjustment_amount_cents',  v_adj_cents,
      'reason',                   p_reason,
      'requested_by',             auth.uid()
    )
  );

  return v_booking;
end;
$$;

grant execute on function public.request_price_adjustment(uuid, integer, text) to authenticated;


-- ── 5. accept_price_adjustment_no_charge RPC ──────────────────────────────────
-- Customer calls this when adjustment_amount_cents ≤ 0 (cleaner lowered price).
-- Transitions directly to payment_authorized. No Stripe checkout required.
-- Any discount is recorded internally; admin processes partial refund after capture.

create or replace function public.accept_price_adjustment_no_charge(
  p_booking_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  if v_booking.customer_id is distinct from auth.uid() then
    raise exception 'Only the customer may accept a price adjustment';
  end if;

  if v_booking.status != 'estimate_adjustment_requested' then
    raise exception
      'Booking is not awaiting an adjustment response (current: %)', v_booking.status;
  end if;

  if coalesce(v_booking.adjustment_amount_cents, 0) > 0 then
    raise exception
      'An additional payment is required — use the Stripe checkout flow for positive adjustments';
  end if;

  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set
    status                          = 'payment_authorized',
    customer_adjustment_response_at = now(),
    updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events
    (booking_id, from_status, to_status, actor_id, actor_role, notes)
  values (
    p_booking_id,
    'estimate_adjustment_requested',
    'payment_authorized',
    auth.uid(),
    'customer',
    'Customer accepted price adjustment (no additional charge required)'
  );

  insert into public.payment_ledger_events (
    booking_id, event_type, amount_cents, currency, stripe_event_id, metadata
  ) values (
    p_booking_id,
    'ESTIMATE_ADJUSTMENT_ACCEPTED',
    v_booking.proposed_total_cents,
    coalesce(v_booking.currency, 'gbp'),
    'synthetic_adj_accepted_' || p_booking_id::text || '_' || extract(epoch from now())::bigint::text,
    jsonb_build_object(
      'proposed_total_cents',     v_booking.proposed_total_cents,
      'adjustment_amount_cents',  v_booking.adjustment_amount_cents,
      'requires_stripe',          false,
      'accepted_by',              auth.uid()
    )
  );

  return v_booking;
end;
$$;

grant execute on function public.accept_price_adjustment_no_charge(uuid) to authenticated;


-- ── 6. reject_price_adjustment RPC ───────────────────────────────────────────
-- Customer rejects the adjustment. p_action: 'reassign' | 'cancel'.
-- 'reassign' → reassign_requested (admin finds new cleaner)
-- 'cancel'   → cancelled (admin processes refund)

create or replace function public.reject_price_adjustment(
  p_booking_id uuid,
  p_action     text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking       public.bookings;
  v_target_status public.booking_status;
  v_admin_id      uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  if v_booking.customer_id is distinct from auth.uid() then
    raise exception 'Only the customer may reject a price adjustment';
  end if;

  if v_booking.status != 'estimate_adjustment_requested' then
    raise exception
      'Booking is not awaiting an adjustment response (current: %)', v_booking.status;
  end if;

  if p_action not in ('reassign', 'cancel') then
    raise exception 'Invalid action: %. Must be ''reassign'' or ''cancel''.', p_action;
  end if;

  v_target_status := case
    when p_action = 'reassign' then 'reassign_requested'::public.booking_status
    else                             'cancelled'::public.booking_status
  end;

  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set
    status                          = v_target_status,
    customer_adjustment_response_at = now(),
    cancellation_reason             = case
                                        when p_action = 'cancel'
                                        then 'Customer rejected price adjustment'
                                        else cancellation_reason
                                      end,
    cancelled_at                    = case
                                        when p_action = 'cancel' then now()
                                        else cancelled_at
                                      end,
    updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events
    (booking_id, from_status, to_status, actor_id, actor_role, notes)
  values (
    p_booking_id,
    'estimate_adjustment_requested',
    v_target_status,
    auth.uid(),
    'customer',
    'Customer rejected price adjustment — action: ' || p_action
  );

  insert into public.payment_ledger_events (
    booking_id, event_type, amount_cents, currency, stripe_event_id, metadata
  ) values (
    p_booking_id,
    'ESTIMATE_ADJUSTMENT_REJECTED',
    v_booking.proposed_total_cents,
    coalesce(v_booking.currency, 'gbp'),
    'synthetic_adj_rejected_' || p_booking_id::text || '_' || extract(epoch from now())::bigint::text,
    jsonb_build_object(
      'action',       p_action,
      'rejected_by',  auth.uid()
    )
  );

  -- Notify cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_booking.cleaner_id,
    'price_adjustment_rejected',
    'Price adjustment rejected',
    case
      when p_action = 'reassign'
      then 'The customer has requested a different cleaner.'
      else 'The customer has rejected the adjustment and cancelled the booking.'
    end,
    p_booking_id,
    jsonb_build_object('booking_id', p_booking_id, 'action', p_action)
  );

  -- Notify admins
  for v_admin_id in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_admin_id,
      case when p_action = 'reassign' then 'reassignment_required' else 'refund_required' end,
      case when p_action = 'reassign'
        then '⚠ Reassignment required — adjustment rejected'
        else '⚠ Refund required — adjustment rejected'
      end,
      case when p_action = 'reassign'
        then 'Customer rejected a price adjustment and requests a new cleaner.'
        else 'Customer rejected a price adjustment and cancelled. Process refund.'
      end,
      p_booking_id,
      jsonb_build_object(
        'booking_id',  p_booking_id,
        'customer_id', v_booking.customer_id,
        'cleaner_id',  v_booking.cleaner_id,
        'action',      p_action
      )
    );
  end loop;

  return v_booking;
end;
$$;

grant execute on function public.reject_price_adjustment(uuid, text) to authenticated;


-- ── 7. Update sync_booking_from_ledger_event ──────────────────────────────────
-- Adds ADDITIONAL_PAYMENT_AUTHORIZED handling.
-- ESTIMATE_ADJUSTMENT_* events are lifecycle-only (RPCs write them; no sync needed).

create or replace function public.sync_booking_from_ledger_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pre_booking_status public.booking_status;
begin
  perform set_config('app.ledger_sync_active', 'true', true);

  case new.event_type

  when 'PAYMENT_AUTHORIZED' then
    select status into v_pre_booking_status
    from public.bookings where id = new.booking_id;

    if v_pre_booking_status is distinct from 'payment_authorized' then
      update public.bookings
      set payment_status = 'authorized',
          status         = 'payment_authorized',
          updated_at     = now()
      where id = new.booking_id;

      update public.payments
      set status                   = 'authorized',
          authorized_at            = coalesce(authorized_at, new.created_at),
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, new.stripe_payment_intent_id)
      where booking_id = new.booking_id;

      insert into public.booking_status_events
        (booking_id, from_status, to_status, actor_id, actor_role, notes)
      values (
        new.booking_id, v_pre_booking_status, 'payment_authorized', null, 'system',
        'Ledger event: PAYMENT_AUTHORIZED (stripe_event_id: ' || new.stripe_event_id || ')'
      );
    end if;

  when 'ADDITIONAL_PAYMENT_AUTHORIZED' then
    -- Customer accepted a positive price adjustment and paid the difference via Stripe.
    -- Transitions estimate_adjustment_requested → payment_authorized.
    select status into v_pre_booking_status
    from public.bookings where id = new.booking_id;

    update public.bookings
    set
      status                          = 'payment_authorized',
      customer_adjustment_response_at = coalesce(customer_adjustment_response_at, now()),
      updated_at                      = now()
    where id = new.booking_id;

    -- Record the additional charge amount
    update public.payments
    set status       = 'authorized',
        amount_cents = coalesce(amount_cents, 0) + coalesce(new.amount_cents, 0),
        authorized_at = coalesce(authorized_at, new.created_at)
    where booking_id = new.booking_id;

    insert into public.booking_status_events
      (booking_id, from_status, to_status, actor_id, actor_role, notes)
    values (
      new.booking_id, v_pre_booking_status, 'payment_authorized', null, 'system',
      'Ledger event: ADDITIONAL_PAYMENT_AUTHORIZED — adjustment payment received '
      || '(stripe_event_id: ' || new.stripe_event_id || ')'
    );

  when 'PAYMENT_CAPTURED' then
    select status into v_pre_booking_status
    from public.bookings where id = new.booking_id;

    update public.bookings
    set payment_status = 'captured', updated_at = now()
    where id = new.booking_id;

    if v_pre_booking_status = 'payment_authorized' then
      update public.bookings
      set status = 'paid', updated_at = now()
      where id = new.booking_id;

      insert into public.booking_status_events
        (booking_id, from_status, to_status, actor_id, actor_role, notes)
      values (
        new.booking_id, 'payment_authorized', 'paid', null, 'system',
        'Ledger event: PAYMENT_CAPTURED (stripe_event_id: ' || new.stripe_event_id || ')'
      );
    end if;

    update public.payments
    set status      = 'captured',
        captured_at = coalesce(captured_at, new.created_at)
    where booking_id = new.booking_id
      and (stripe_payment_intent_id = new.stripe_payment_intent_id
           or new.stripe_payment_intent_id is null);

  when 'PAYMENT_REFUNDED' then
    update public.bookings
    set payment_status = 'refunded', updated_at = now()
    where id = new.booking_id;

    update public.payments
    set status      = 'refunded',
        refunded_at = coalesce(refunded_at, new.created_at)
    where booking_id = new.booking_id;

  when 'PAYOUT_RELEASED' then
    if new.stripe_transfer_id is not null then
      update public.payouts
      set status = 'paid', updated_at = now()
      where stripe_transfer_id = new.stripe_transfer_id;
    end if;

  when 'PAYOUT_REVERSED' then
    if new.stripe_transfer_id is not null then
      update public.payouts
      set status = 'reversed', updated_at = now()
      where stripe_transfer_id = new.stripe_transfer_id;
    end if;

  when 'ESTIMATE_ADJUSTMENT_REQUESTED',
       'ESTIMATE_ADJUSTMENT_ACCEPTED',
       'ESTIMATE_ADJUSTMENT_REJECTED' then
    -- Lifecycle events written by RPCs. Status was already updated by the RPC.
    -- No additional sync needed here.
    null;

  else
    raise notice 'sync_booking_from_ledger_event: unknown event_type %', new.event_type;

  end case;

  return new;
end;
$$;


-- ── 8. Update notify_booking_participants ─────────────────────────────────────
-- Adds notification for estimate_adjustment_requested.
-- Adjusts payment_authorized notification when coming from estimate_adjustment_requested.

create or replace function public.notify_booking_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INSERT: no notification in pay-before-accept model
  if TG_OP = 'INSERT' then
    return new;
  end if;

  -- Status unchanged: skip
  if old.status is not distinct from new.status then
    return new;
  end if;

  case new.status

    when 'estimate_adjustment_requested' then
      -- Cleaner requested a price adjustment — notify customer
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'price_adjustment_requested',
        'Price adjustment requested',
        'Your cleaner has requested a price adjustment. Please review and respond.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'payment_authorized' then
      if old.status = 'estimate_adjustment_requested' then
        -- Adjustment accepted and paid — notify cleaner
        insert into public.notifications (user_id, type, title, body, booking_id, metadata)
        values (
          new.cleaner_id,
          'price_adjustment_accepted',
          'Price adjustment accepted',
          'The customer has accepted your price adjustment. The booking is confirmed.',
          new.id,
          jsonb_build_object('booking_id', new.id)
        );
      else
        -- Standard pay-before-accept: first time cleaner sees the booking
        insert into public.notifications (user_id, type, title, body, booking_id, metadata)
        values (
          new.cleaner_id,
          'payment_received',
          'New paid booking',
          'A customer has paid for a booking. Review and accept to confirm the job.',
          new.id,
          jsonb_build_object('booking_id', new.id)
        );
      end if;

    when 'estimate_proposed' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'booking_accepted',
        'Booking accepted',
        'Your cleaner has reviewed and accepted your booking request.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'accepted' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'booking_confirmed',
        'Booking confirmed',
        'Your cleaner has accepted the booking. Everything is set for your cleaning day.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'in_progress' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'booking_in_progress',
        'Cleaning in progress',
        'Your cleaner has started the job.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'completion_pending_customer' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'completion_pending',
        'Please confirm job completion',
        'Your cleaner has marked the job as done. Please confirm to release their payment.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'completed' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.cleaner_id,
        'booking_completed',
        'Job confirmed — payout queued',
        'The customer has confirmed the job is complete. Your payout will be released shortly.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'cleaner_declined' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'booking_declined',
        'Booking declined',
        'Your cleaner was unable to take this booking. Please search for another cleaner.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'cancelled' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values
        (new.cleaner_id, 'booking_cancelled', 'Booking cancelled',
         'A booking assigned to you has been cancelled.',
         new.id, jsonb_build_object('booking_id', new.id)),
        (new.customer_id, 'booking_cancelled', 'Booking cancelled',
         'Your booking has been cancelled.',
         new.id, jsonb_build_object('booking_id', new.id));

    when 'disputed' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.cleaner_id,
        'booking_disputed',
        'Dispute opened',
        'The customer has opened a dispute for this booking. Our team will be in touch.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    when 'refunded' then
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (
        new.customer_id,
        'booking_refunded',
        'Refund issued',
        'Your dispute has been resolved and a refund has been issued.',
        new.id,
        jsonb_build_object('booking_id', new.id)
      );

    else
      null;

  end case;

  return new;
end;
$$;


-- ── 9. Update transition_booking_state ───────────────────────────────────────
-- Allow admin and customer transitions from estimate_adjustment_requested.
-- Also allows cancellation from estimate_adjustment_requested.

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
  v_payment_state     text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then raise exception 'Booking not found'; end if;

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

  v_payment_state := public.derive_payment_state_from_ledger(p_booking_id);

  -- ── ACCEPTANCE ───────────────────────────────────────────────────────────────
  if v_source_status = 'payment_authorized' and p_target_status = 'accepted' and v_actor_is_cleaner then
    if exists (
      select 1 from public.bookings b
      where  b.cleaner_id  = v_booking.cleaner_id
        and  b.id         != p_booking_id
        and  b.status::text in ('accepted', 'paid', 'in_progress')
        and  b.scheduled_start < v_booking.scheduled_end
        and  b.scheduled_end   > v_booking.scheduled_start
    ) then
      raise exception 'Cleaner is no longer available for this time slot.';
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'payment_authorized' and p_target_status = 'accepted' and v_actor_is_admin then
    v_is_allowed := true;

  elsif p_target_status = 'accepted'
    and v_source_status::text in (
      'cleaner_no_show', 'accepted', 'in_progress', 'pending_request',
      'cleaner_cancelled', 'reassign_requested', 'paid', 'payment_authorized'
    )
    and v_actor_is_admin
  then v_is_allowed := true;

  elsif p_target_status = 'accepted'
    and v_source_status::text in ('cleaner_cancelled', 'cleaner_no_show', 'reassign_requested')
    and v_actor_is_customer
  then v_is_allowed := true;

  -- ── PAID ──────────────────────────────────────────────────────────────────────
  elsif v_source_status = 'accepted' and p_target_status = 'paid' and v_actor_is_admin then
    v_is_allowed := true;

  -- ── IN PROGRESS ───────────────────────────────────────────────────────────────
  elsif v_source_status in ('paid', 'accepted')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_payment_state != 'captured' then
      raise exception
        'Cannot start booking: payment has not been captured (ledger state: %)', v_payment_state;
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'payment_authorized'
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status in ('paid_pending_start', 'scheduled')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then v_is_allowed := true;

  -- ── COMPLETED ─────────────────────────────────────────────────────────────────
  elsif v_source_status = 'in_progress' and p_target_status = 'completed'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_payment_state not in ('captured', 'authorized') then
      raise exception
        'Cannot complete booking: payment not received (ledger state: %)', v_payment_state;
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'completion_pending_customer'
    and p_target_status = 'completed'
    and (v_actor_is_customer or v_actor_is_admin)
  then v_is_allowed := true;

  -- ── COMPLETION PENDING CUSTOMER ───────────────────────────────────────────────
  elsif v_source_status = 'in_progress'
    and p_target_status = 'completion_pending_customer'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then v_is_allowed := true;

  -- ── DISPUTED ──────────────────────────────────────────────────────────────────
  elsif v_source_status in ('completed', 'completion_pending_customer')
    and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then v_is_allowed := true;

  elsif v_source_status = 'in_progress' and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then v_is_allowed := true;

  -- ── DECLINED ──────────────────────────────────────────────────────────────────
  elsif v_source_status = 'pending_request'
    and p_target_status in ('declined', 'cleaner_declined')
    and (v_actor_is_cleaner or v_actor_is_admin)
  then v_is_allowed := true;

  elsif v_source_status = 'payment_authorized'
    and p_target_status = 'cleaner_declined'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then v_is_allowed := true;

  -- ── CANCELLED ─────────────────────────────────────────────────────────────────
  elsif v_source_status::text in (
      'pending_request', 'accepted', 'paid',
      'estimate_proposed', 'awaiting_customer_payment',
      'payment_authorized', 'estimate_adjustment_requested'
    )
    and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin)
  then v_is_allowed := true;

  elsif v_source_status::text in ('accepted', 'paid', 'cleaner_no_show')
    and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin)
  then v_is_allowed := true;

  -- ── CLEANER CANCELLED ─────────────────────────────────────────────────────────
  elsif v_source_status::text in ('pending_request', 'accepted', 'paid', 'payment_authorized')
    and p_target_status = 'cleaner_cancelled'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.started_at is not null then
      raise exception 'Booking has already started and cannot be cancelled this way';
    end if;
    v_is_allowed := true;

  -- ── CLEANER NO SHOW ───────────────────────────────────────────────────────────
  elsif v_source_status::text in ('accepted', 'paid', 'cleaner_no_show')
    and p_target_status = 'cleaner_no_show'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    if v_booking.started_at is not null then raise exception 'This booking has already been started'; end if;
    if now() <= v_booking.scheduled_start + interval '30 minutes' then
      raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
    end if;
    v_is_allowed := true;

  -- ── REFUNDED ──────────────────────────────────────────────────────────────────
  elsif p_target_status = 'refunded'
    and v_actor_is_admin
    and v_source_status::text not in ('refunded', 'declined', 'cleaner_declined')
  then v_is_allowed := true;

  -- ── REASSIGN REQUESTED (admin override from adjustment) ───────────────────────
  elsif v_source_status = 'estimate_adjustment_requested'
    and p_target_status = 'reassign_requested'
    and v_actor_is_admin
  then v_is_allowed := true;

  -- ── LEGACY ESTIMATE FLOW (kept for backward compat, no longer reachable via RLS) ──
  elsif v_source_status = 'pending_request'
    and p_target_status = 'estimate_proposed'
    and v_actor_is_cleaner
  then v_is_allowed := true;

  elsif v_source_status = 'estimate_proposed'
    and p_target_status = 'awaiting_customer_payment'
    and v_actor_is_customer
  then v_is_allowed := true;

  elsif v_source_status = 'awaiting_customer_payment'
    and p_target_status = 'payment_authorized'
    and v_actor_is_customer
  then v_is_allowed := true;

  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition: % → % (actor: %)',
      v_source_status, p_target_status, v_actor_role;
  end if;

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

  -- Auto-advance accepted → paid when ledger confirms payment captured
  if p_target_status = 'accepted' and v_payment_state = 'captured' then
    update public.bookings set status = 'paid', updated_at = now()
    where id = p_booking_id returning * into v_booking;
    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (p_booking_id, 'accepted', 'paid', auth.uid(), 'Auto-advanced: ledger confirms PAYMENT_CAPTURED', 'system');
  end if;

  -- Dispute record
  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id, auth.uid(), coalesce(p_note, 'Dispute opened'))
    on conflict (booking_id) do nothing;
  end if;

  if not p_notify then return v_booking; end if;

  -- Notifications
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
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'cleaner_cancelled', 'Cleaner cannot attend',
            'Your cleaner is unable to attend. We are working to arrange a replacement.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'cleaner_cancelled', '⚠ Cleaner cannot attend — action required',
              'A cleaner has cancelled. Reassign or refund the customer.',
              p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', v_booking.cleaner_id, 'customer_id', v_booking.customer_id, 'reason', p_note));
    end loop;
  elsif p_target_status = 'cleaner_no_show' then
    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'cleaner_no_show', 'Cleaner did not attend booking',
              coalesce(case when p_note = 'replacement_requested' then 'Customer requested another cleaner.'
                            when p_note = 'refund_requested' then 'Customer requested a refund.'
                            else null end, 'No-show reported.'),
              p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'cleaner_id', v_booking.cleaner_id, 'customer_id', v_booking.customer_id, 'action', p_note));
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


-- ── 10. RLS: cleaners can see estimate_adjustment_requested bookings ───────────
-- The existing "Cleaner views paid bookings" policy blocks 'pending_request' only.
-- 'estimate_adjustment_requested' is visible to the assigned cleaner already
-- because the policy only checks status != 'pending_request'. No change needed.

comment on policy "Cleaner views paid bookings" on public.bookings is
  'Cleaners see all bookings except pending_request (unpaid). '
  'This includes estimate_adjustment_requested, payment_authorized, accepted, etc.';
