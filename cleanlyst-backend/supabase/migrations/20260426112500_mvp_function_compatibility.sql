-- =========================
-- AUTH PROFILE CREATION FIX
-- =========================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  resolved_role public.user_role;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'customer');

  resolved_role := case requested_role
    when 'cleaner' then 'cleaner_pending'
    when 'cleaner_pending' then 'cleaner_pending'
    when 'cleaner_active' then 'cleaner_active'
    when 'admin' then 'admin'
    else 'customer'
  end;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    resolved_role,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User')
  );

  if resolved_role in ('cleaner_pending', 'cleaner_active') then
    insert into public.cleaner_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.cleaner_applications (cleaner_id)
    values (new.id)
    on conflict (cleaner_id) do nothing;
  end if;

  return new;
end;
$$;

-- =========================
-- LEGACY ACCEPT BOOKING FIX
-- =========================

create or replace function public.accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_booking public.bookings;
begin
  update public.bookings
  set
    status = 'estimate_proposed',
    accepted_at = now(),
    updated_at = now()
  where id = p_booking_id
    and cleaner_id = auth.uid()
    and status = 'pending_request'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'Booking not found or cannot be accepted';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (updated_booking.id, 'pending_request', 'estimate_proposed', auth.uid());

  return updated_booking;
end;
$$;
