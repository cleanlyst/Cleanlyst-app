-- =============================================================================
-- FINANCIAL LEDGER — append-only source of financial truth
-- =============================================================================
-- Replaces mutable bookings.payment_status as the system source of truth.
--
-- Architecture:
--   Stripe webhook     → INSERT INTO payment_ledger_events (ledger writer only)
--   Ledger trigger     → updates bookings.payment_status cache + bookings.status
--   derive_payment_state_from_ledger() → queried by RPCs for financial decisions
--   paymentLedgerResolver.ts           → queried by frontend for UI derivation
--
-- bookings.payment_status is now a DENORMALIZED CACHE updated by the trigger.
-- It must never be used for authoritative financial decisions — use the ledger.
--
-- Supersedes:
--   trg_guard_booking_status_write  from 20260622300000 (adds ledger_sync_active flag)
--   transition_booking_state        from 20260622300000 (uses derive_payment_state_from_ledger)


-- =============================================================================
-- SECTION 1 — payment_ledger_events TABLE
-- =============================================================================

create table if not exists public.payment_ledger_events (
  id                       uuid        not null default gen_random_uuid() primary key,
  booking_id               uuid        not null references public.bookings(id),
  event_type               text        not null,
  amount_cents             integer,
  currency                 text        not null default 'gbp',
  stripe_event_id          text        not null,
  stripe_payment_intent_id text,
  stripe_transfer_id       text,
  metadata                 jsonb       not null default '{}',
  created_at               timestamptz not null default now(),

  constraint payment_ledger_events_event_type_check check (
    event_type in (
      'PAYMENT_AUTHORIZED',
      'PAYMENT_CAPTURED',
      'PAYMENT_REFUNDED',
      'PAYOUT_RELEASED',
      'PAYOUT_REVERSED'
    )
  ),
  constraint payment_ledger_events_stripe_event_id_key unique (stripe_event_id)
);

create index if not exists idx_payment_ledger_events_booking_id
  on public.payment_ledger_events (booking_id);

create index if not exists idx_payment_ledger_events_stripe_event_id
  on public.payment_ledger_events (stripe_event_id);

create index if not exists idx_payment_ledger_events_event_type
  on public.payment_ledger_events (event_type);

comment on table public.payment_ledger_events is
  'Append-only financial event log. SOURCE OF FINANCIAL TRUTH. Never mutate rows.';

-- RLS — allow service_role to insert, authenticated to read own booking events
alter table public.payment_ledger_events enable row level security;

create policy "service_role manages ledger"
  on public.payment_ledger_events
  for all
  to service_role
  using (true)
  with check (true);

create policy "authenticated reads own ledger events"
  on public.payment_ledger_events
  for select
  to authenticated
  using (
    booking_id in (
      select id from public.bookings
      where customer_id = auth.uid() or cleaner_id = auth.uid()
    )
    or public.is_admin()
  );


-- =============================================================================
-- SECTION 2 — IMMUTABILITY TRIGGER
-- =============================================================================
-- Prevents UPDATE and DELETE on the ledger. service_role may update for
-- emergency corrections (e.g. wrong stripe_event_id) but normal operations
-- must never mutate ledger rows.

create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role bypass — for admin corrections only (audit these operations manually)
  if current_user in ('service_role', 'supabase_admin') then
    return new;
  end if;

  raise exception
    'payment_ledger_events is append-only. UPDATE and DELETE are forbidden. '
    'Financial history must never be mutated. (caller role: %)', current_user;
end;
$$;

create trigger trg_ledger_immutable
before update or delete on public.payment_ledger_events
for each row
execute function public.prevent_ledger_mutation();

revoke execute on function public.prevent_ledger_mutation() from public, anon, authenticated;


-- =============================================================================
-- SECTION 3 — derive_payment_state_from_ledger
-- =============================================================================
-- Deterministic: reads ONLY from payment_ledger_events.
-- Called by transition_booking_state and any RPC that gates on financial state.
-- NEVER reads bookings.payment_status.

create or replace function public.derive_payment_state_from_ledger(p_booking_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Priority order: REFUNDED > CAPTURED > AUTHORIZED > unpaid
  -- A refund always supersedes any prior capture or authorization.
  if exists (
    select 1 from public.payment_ledger_events
    where booking_id = p_booking_id and event_type = 'PAYMENT_REFUNDED'
  ) then
    return 'refunded';
  end if;

  if exists (
    select 1 from public.payment_ledger_events
    where booking_id = p_booking_id and event_type = 'PAYMENT_CAPTURED'
  ) then
    return 'captured';
  end if;

  if exists (
    select 1 from public.payment_ledger_events
    where booking_id = p_booking_id and event_type = 'PAYMENT_AUTHORIZED'
  ) then
    return 'authorized';
  end if;

  return 'unpaid';
end;
$$;

grant execute on function public.derive_payment_state_from_ledger(uuid) to authenticated, service_role;

comment on function public.derive_payment_state_from_ledger(uuid) is
  'Derives payment state from ledger only. Called by RPCs that gate on financial state. Never reads bookings.payment_status.';


-- =============================================================================
-- SECTION 4 — Update guard_booking_status_write
-- =============================================================================
-- Extends the guard added in 20260622300000 to also allow writes when
-- the ledger sync trigger sets app.ledger_sync_active = 'true'.
-- Supersedes the version created in 20260622300000.

create or replace function public.guard_booking_status_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (Stripe webhook, refund-payment EF) is always allowed.
  if current_user in ('service_role', 'supabase_admin') then return new; end if;

  -- postgres is allowed when either:
  --   a) transition_booking_state set app.tbs_active (booking lifecycle RPC)
  --   b) sync_booking_from_ledger_event set app.ledger_sync_active (ledger trigger)
  if current_user = 'postgres'
     and (
       current_setting('app.tbs_active', true)        = 'true'
       or current_setting('app.ledger_sync_active', true) = 'true'
     )
  then
    return new;
  end if;

  raise exception
    'Direct writes to bookings.status/cancellation_reason/reassigned_at are forbidden. '
    'Use transition_booking_state RPC or the payment ledger. '
    '(caller role: %, tbs_active: %, ledger_sync_active: %)',
    current_user,
    coalesce(current_setting('app.tbs_active', true),        'unset'),
    coalesce(current_setting('app.ledger_sync_active', true), 'unset');
end;
$$;


-- =============================================================================
-- SECTION 5 — sync_booking_from_ledger_event TRIGGER
-- =============================================================================
-- Fires AFTER INSERT on payment_ledger_events.
-- Updates denormalized caches: bookings.payment_status, bookings.status (conditional),
-- payments.status, payouts.status. All writes bypass the status guard via
-- app.ledger_sync_active session flag.

create or replace function public.sync_booking_from_ledger_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pre_booking_status public.booking_status;
begin
  -- Allow this SECURITY DEFINER function (runs as postgres) to write
  -- to guarded booking fields. Local to this transaction.
  perform set_config('app.ledger_sync_active', 'true', true);

  case NEW.event_type

  when 'PAYMENT_AUTHORIZED' then
    -- Idempotency: skip if already in payment_authorized
    select status into v_pre_booking_status
    from public.bookings
    where id = NEW.booking_id;

    if v_pre_booking_status is distinct from 'payment_authorized' then
      update public.bookings
      set payment_status = 'authorized',
          status         = 'payment_authorized',
          updated_at     = now()
      where id = NEW.booking_id;

      update public.payments
      set status                    = 'authorized',
          authorized_at             = coalesce(authorized_at, NEW.created_at),
          stripe_payment_intent_id  = coalesce(stripe_payment_intent_id, NEW.stripe_payment_intent_id)
      where booking_id = NEW.booking_id;

      insert into public.booking_status_events
        (booking_id, from_status, to_status, actor_id, actor_role, notes)
      values (
        NEW.booking_id,
        v_pre_booking_status,
        'payment_authorized',
        null,
        'system',
        'Ledger event: PAYMENT_AUTHORIZED (stripe_event_id: ' || NEW.stripe_event_id || ')'
      );
    end if;

  when 'PAYMENT_CAPTURED' then
    select status into v_pre_booking_status
    from public.bookings
    where id = NEW.booking_id;

    -- Always update payment_status cache
    update public.bookings
    set payment_status = 'captured',
        updated_at     = now()
    where id = NEW.booking_id;

    -- PAYMENT_CAPTURED → booking becomes 'paid' if it was payment_authorized
    if v_pre_booking_status = 'payment_authorized' then
      update public.bookings
      set status     = 'paid',
          updated_at = now()
      where id = NEW.booking_id;

      insert into public.booking_status_events
        (booking_id, from_status, to_status, actor_id, actor_role, notes)
      values (
        NEW.booking_id,
        'payment_authorized',
        'paid',
        null,
        'system',
        'Ledger event: PAYMENT_CAPTURED — payment captured, booking advanced to paid '
        || '(stripe_event_id: ' || NEW.stripe_event_id || ')'
      );
    end if;

    update public.payments
    set status       = 'captured',
        captured_at  = coalesce(captured_at, NEW.created_at)
    where booking_id = NEW.booking_id
      and (stripe_payment_intent_id = NEW.stripe_payment_intent_id
           or NEW.stripe_payment_intent_id is null);

  when 'PAYMENT_REFUNDED' then
    -- Update payment_status cache. bookings.status was already set by
    -- refund-payment EF (for auth cancels) or charge.refunded state machine handler.
    update public.bookings
    set payment_status = 'refunded',
        updated_at     = now()
    where id = NEW.booking_id;

    update public.payments
    set status       = 'refunded',
        refunded_at  = coalesce(refunded_at, NEW.created_at)
    where booking_id = NEW.booking_id;

  when 'PAYOUT_RELEASED' then
    -- Ledger event: cleaner payout settled to bank account.
    -- Update payouts table using the Stripe transfer ID.
    if NEW.stripe_transfer_id is not null then
      update public.payouts
      set status     = 'paid',
          updated_at = now()
      where stripe_transfer_id = NEW.stripe_transfer_id;
    end if;

  when 'PAYOUT_REVERSED' then
    if NEW.stripe_transfer_id is not null then
      update public.payouts
      set status     = 'reversed',
          updated_at = now()
      where stripe_transfer_id = NEW.stripe_transfer_id;
    end if;

  else
    -- Unknown event type — log and skip
    raise notice 'sync_booking_from_ledger_event: unknown event_type %', NEW.event_type;

  end case;

  return NEW;
end;
$$;

create trigger trg_sync_booking_from_ledger
after insert on public.payment_ledger_events
for each row
execute function public.sync_booking_from_ledger_event();

revoke execute on function public.sync_booking_from_ledger_event() from public, anon, authenticated;


-- =============================================================================
-- SECTION 6 — Updated transition_booking_state
-- =============================================================================
-- Replaces all direct bookings.payment_status reads with
-- derive_payment_state_from_ledger() calls.
-- Supersedes the version in 20260622300000.

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

  -- Derive financial state from ledger (single call, cached in local var)
  v_payment_state := public.derive_payment_state_from_ledger(p_booking_id);

  -- ── ACCEPTANCE ───────────────────────────────────────────────────────────────
  if v_source_status = 'pending_request' and p_target_status = 'accepted' and v_actor_is_cleaner then
    if exists (
      select 1 from public.bookings b
      where  b.cleaner_id      = v_booking.cleaner_id
        and  b.id             != p_booking_id
        and  b.status::text in ('accepted', 'paid', 'in_progress')
        and  b.scheduled_start < v_booking.scheduled_end
        and  b.scheduled_end   > v_booking.scheduled_start
    ) then
      raise exception 'Cleaner is no longer available for this time slot.';
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'pending_request' and p_target_status = 'accepted' and v_actor_is_admin then
    v_is_allowed := true;

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

  -- ── PAID ──────────────────────────────────────────────────────────────────────
  elsif v_source_status = 'accepted' and p_target_status = 'paid' and v_actor_is_admin then
    v_is_allowed := true;

  -- ── IN PROGRESS ───────────────────────────────────────────────────────────────
  elsif v_source_status in ('paid', 'accepted')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    -- Financial gate: derived from ledger, not from bookings.payment_status
    if v_payment_state != 'captured' then
      raise exception
        'Cannot start booking: customer payment has not been received '
        '(ledger state: %, booking_id: %)', v_payment_state, p_booking_id;
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'payment_authorized'
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    -- Stripe capture_method: manual — payment held via ledger PAYMENT_AUTHORIZED event.
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status in ('paid_pending_start', 'scheduled')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── COMPLETED ─────────────────────────────────────────────────────────────────
  elsif v_source_status = 'in_progress' and p_target_status = 'completed'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    -- Financial gate: derived from ledger
    if v_payment_state not in ('captured', 'authorized') then
      raise exception
        'Cannot complete booking: payment not received '
        '(ledger state: %, booking_id: %)', v_payment_state, p_booking_id;
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'completion_pending_customer'
    and p_target_status = 'completed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── COMPLETION PENDING CUSTOMER ───────────────────────────────────────────────
  elsif v_source_status = 'in_progress'
    and p_target_status = 'completion_pending_customer'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── DISPUTED ──────────────────────────────────────────────────────────────────
  elsif v_source_status in ('completed', 'completion_pending_customer')
    and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  elsif v_source_status = 'in_progress' and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── DECLINED ──────────────────────────────────────────────────────────────────
  elsif v_source_status = 'pending_request'
    and p_target_status in ('declined', 'cleaner_declined')
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── CANCELLED ─────────────────────────────────────────────────────────────────
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

  -- ── CLEANER CANCELLED ─────────────────────────────────────────────────────────
  elsif v_source_status::text in ('pending_request', 'accepted', 'paid')
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
    if v_booking.started_at is not null then
      raise exception 'This booking has already been started';
    end if;
    if now() <= v_booking.scheduled_start + interval '30 minutes' then
      raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
    end if;
    v_is_allowed := true;

  -- ── REFUNDED ──────────────────────────────────────────────────────────────────
  elsif p_target_status = 'refunded'
    and v_actor_is_admin
    and v_source_status::text not in ('refunded', 'declined', 'cleaner_declined')
  then
    v_is_allowed := true;

  -- ── ESTIMATE FLOW ─────────────────────────────────────────────────────────────
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

  -- Allow postgres-role writes to guarded fields (local to this transaction)
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
    update public.bookings
    set status = 'paid', updated_at = now()
    where id = p_booking_id
    returning * into v_booking;

    insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
    values (p_booking_id, 'accepted', 'paid', auth.uid(),
            'Auto-advanced: ledger confirms PAYMENT_CAPTURED', 'system');
  end if;

  -- Dispute record
  if p_target_status = 'disputed' then
    insert into public.disputes (booking_id, customer_id, cleaner_id, opened_by, reason)
    values (v_booking.id, v_booking.customer_id, v_booking.cleaner_id,
            auth.uid(), coalesce(p_note, 'Dispute opened'))
    on conflict (booking_id) do nothing;
  end if;

  -- Notifications (skipped when caller handles its own)
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
