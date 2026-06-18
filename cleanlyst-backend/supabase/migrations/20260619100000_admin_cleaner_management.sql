-- ============================================================
-- ADMIN CLEANER MANAGEMENT
--
-- 1. Add 'deactivated' to cleaner_status enum
-- 2. Admin RLS policies for profiles + cleaner_profiles
-- 3. admin_suspend_cleaner / admin_reactivate_cleaner /
--    admin_deactivate_cleaner RPCs
-- 4. admin_get_all_cleaners — paginated list with stats
-- 5. admin_get_cleaner_profile — full profile for modal
-- ============================================================

-- ── 1. Extend enum ──────────────────────────────────────────
alter type public.cleaner_status add value if not exists 'deactivated';

-- ── 2. Admin RLS policies ────────────────────────────────────
-- Admins need to read ALL profiles (not just their own) and ALL
-- cleaner_profiles (not just approved ones).

drop policy if exists "Admin reads all profiles" on public.profiles;
create policy "Admin reads all profiles"
  on public.profiles
  for select
  using (public.is_admin());

drop policy if exists "Admin reads all cleaner profiles" on public.cleaner_profiles;
create policy "Admin reads all cleaner profiles"
  on public.cleaner_profiles
  for select
  using (public.is_admin());

drop policy if exists "Admin updates cleaner profiles" on public.cleaner_profiles;
create policy "Admin updates cleaner profiles"
  on public.cleaner_profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── 3a. Suspend ──────────────────────────────────────────────
create or replace function public.admin_suspend_cleaner(
  p_cleaner_id uuid,
  p_reason      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can suspend cleaners';
  end if;

  if not exists (select 1 from public.cleaner_profiles where user_id = p_cleaner_id) then
    raise exception 'Cleaner not found';
  end if;

  update public.cleaner_profiles
  set status = 'suspended', updated_at = now()
  where user_id = p_cleaner_id;

  update public.profiles
  set is_active = false, updated_at = now()
  where id = p_cleaner_id;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    p_cleaner_id,
    'account_suspended',
    'Your account has been suspended',
    coalesce(
      p_reason,
      'Your cleaner account has been temporarily suspended. Please contact support.'
    ),
    jsonb_build_object('reason', p_reason, 'suspended_by', auth.uid())
  );
end;
$$;

grant execute on function public.admin_suspend_cleaner(uuid, text) to authenticated;

-- ── 3b. Reactivate ───────────────────────────────────────────
create or replace function public.admin_reactivate_cleaner(p_cleaner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reactivate cleaners';
  end if;

  if not exists (
    select 1 from public.cleaner_profiles
    where user_id = p_cleaner_id and status = 'suspended'
  ) then
    raise exception 'Cleaner not found or is not suspended';
  end if;

  update public.cleaner_profiles
  set status = 'approved', updated_at = now()
  where user_id = p_cleaner_id;

  update public.profiles
  set is_active = true, updated_at = now()
  where id = p_cleaner_id;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    p_cleaner_id,
    'account_reactivated',
    'Your account has been reactivated',
    'Your cleaner account has been reactivated. You can now receive and accept bookings again.',
    jsonb_build_object('reactivated_by', auth.uid())
  );
end;
$$;

grant execute on function public.admin_reactivate_cleaner(uuid) to authenticated;

-- ── 3c. Deactivate ───────────────────────────────────────────
create or replace function public.admin_deactivate_cleaner(p_cleaner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can deactivate cleaners';
  end if;

  if not exists (select 1 from public.cleaner_profiles where user_id = p_cleaner_id) then
    raise exception 'Cleaner not found';
  end if;

  update public.cleaner_profiles
  set status = 'deactivated', updated_at = now()
  where user_id = p_cleaner_id;

  update public.profiles
  set is_active = false, updated_at = now()
  where id = p_cleaner_id;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    p_cleaner_id,
    'account_deactivated',
    'Your account has been deactivated',
    'Your cleaner account has been deactivated. Historical booking data is retained. Please contact support.',
    jsonb_build_object('deactivated_by', auth.uid())
  );
end;
$$;

grant execute on function public.admin_deactivate_cleaner(uuid) to authenticated;

-- ── 4. admin_get_all_cleaners ────────────────────────────────
-- Returns paginated list of all cleaners with aggregated stats.
-- Email is sourced from auth.users (requires SECURITY DEFINER).

create or replace function public.admin_get_all_cleaners(
  p_search  text    default null,
  p_status  text    default null,
  p_limit   integer default 10,
  p_offset  integer default 0
)
returns table (
  user_id              uuid,
  full_name            text,
  email                text,
  city                 text,
  avatar_url           text,
  business_name        text,
  cleaner_status       text,
  is_active            boolean,
  average_rating       numeric,
  review_count         integer,
  total_bookings       bigint,
  completed_bookings   bigint,
  total_earnings_cents bigint,
  joined_at            timestamptz,
  approval_date        timestamptz,
  has_availability     boolean,
  documents_verified   boolean,
  total_count          bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can access this function';
  end if;

  return query
  with base as (
    select
      cp.user_id,
      p.full_name,
      u.email::text               as email,
      p.city,
      p.avatar_url,
      cp.business_name,
      cp.status::text             as cleaner_status,
      p.is_active,
      cp.average_rating,
      cp.review_count,
      cp.created_at               as joined_at,
      cp.approval_date
    from public.cleaner_profiles cp
    join public.profiles          p  on p.id  = cp.user_id
    join auth.users               u  on u.id  = cp.user_id
    where
      (
        p_search is null
        or p.full_name    ilike '%' || p_search || '%'
        or u.email        ilike '%' || p_search || '%'
        or p.city         ilike '%' || p_search || '%'
        or cp.business_name ilike '%' || p_search || '%'
      )
      and (p_status is null or cp.status::text = p_status)
  ),
  stats as (
    select
      b.cleaner_id,
      count(b.id)                                             as total_bookings,
      count(b.id) filter (where b.status = 'completed')      as completed_bookings,
      coalesce(sum(b.cleaner_payout_cents)
        filter (where b.status = 'completed'), 0)::bigint    as total_earnings_cents
    from public.bookings b
    where b.cleaner_id in (select user_id from base)
    group by b.cleaner_id
  ),
  avail as (
    select distinct cleaner_id
    from public.availability_slots
    where cleaner_id in (select user_id from base)
  ),
  docs as (
    select
      ca.cleaner_id,
      bool_and(coalesce(cad.admin_verified, false)) as all_verified
    from public.cleaner_applications     ca
    join public.cleaner_application_documents cad on cad.application_id = ca.id
    where ca.cleaner_id in (select user_id from base)
      and cad.file_path is not null
    group by ca.cleaner_id
  ),
  counted as (
    select count(*) as total_count from base
  )
  select
    b.user_id,
    b.full_name,
    b.email,
    b.city,
    b.avatar_url,
    b.business_name,
    b.cleaner_status,
    b.is_active,
    b.average_rating,
    b.review_count,
    coalesce(s.total_bookings,     0)::bigint as total_bookings,
    coalesce(s.completed_bookings, 0)::bigint as completed_bookings,
    coalesce(s.total_earnings_cents, 0)       as total_earnings_cents,
    b.joined_at,
    b.approval_date,
    (a.cleaner_id is not null)                as has_availability,
    coalesce(d.all_verified, false)           as documents_verified,
    c.total_count
  from base          b
  cross join counted c
  left join stats    s on s.cleaner_id     = b.user_id
  left join avail    a on a.cleaner_id     = b.user_id
  left join docs     d on d.cleaner_id     = b.user_id
  order by b.joined_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

grant execute on function public.admin_get_all_cleaners(text, text, integer, integer) to authenticated;

-- ── 5. admin_get_cleaner_profile ─────────────────────────────
-- Full cleaner profile for the admin "View Profile" modal.

create or replace function public.admin_get_cleaner_profile(p_cleaner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can access this function';
  end if;

  select jsonb_build_object(
    'user_id',         cp.user_id,
    'full_name',       p.full_name,
    'email',           u.email,
    'city',            p.city,
    'country',         p.country,
    'avatar_url',      p.avatar_url,
    'phone',           p.phone,
    'business_name',   cp.business_name,
    'bio',             cp.bio,
    'status',          cp.status,
    'is_active',       p.is_active,
    'average_rating',  cp.average_rating,
    'review_count',    cp.review_count,
    'onboarding_complete', cp.onboarding_complete,
    'joined_at',       cp.created_at,
    'approval_date',   cp.approval_date,
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',          s.id,
        'title',       s.title,
        'category',    s.category,
        'description', s.description,
        'base_price_pence', s.base_price_pence,
        'duration_minutes', s.duration_minutes,
        'active',      s.active
      ) order by s.title), '[]'::jsonb)
      from public.services s
      where s.cleaner_id = cp.user_id and s.active = true
    ),
    'upcoming_bookings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',              b.id,
        'status',          b.status,
        'scheduled_start', b.scheduled_start,
        'service_title',   b.service_title_snapshot,
        'quote_cents',     b.quote_cents,
        'customer_name',   cust.full_name
      ) order by b.scheduled_start), '[]'::jsonb)
      from public.bookings b
      join public.profiles cust on cust.id = b.customer_id
      where b.cleaner_id = cp.user_id
        and b.scheduled_start >= now()
        and b.status not in ('cancelled', 'refunded', 'cleaner_cancelled', 'declined', 'cleaner_declined')
    ),
    'completed_bookings_count', (
      select count(*) from public.bookings
      where cleaner_id = cp.user_id and status = 'completed'
    ),
    'total_earnings_cents', (
      select coalesce(sum(cleaner_payout_cents), 0)
      from public.bookings
      where cleaner_id = cp.user_id and status = 'completed'
    ),
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',            cad.id,
        'document_type', cad.document_type,
        'file_path',     cad.file_path,
        'mime_type',     cad.mime_type,
        'uploaded_at',   cad.uploaded_at,
        'admin_verified', cad.admin_verified
      ) order by cad.document_type), '[]'::jsonb)
      from public.cleaner_application_documents cad
      join public.cleaner_applications ca on ca.id = cad.application_id
      where ca.cleaner_id = cp.user_id
    ),
    'reviews', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',          r.id,
        'rating',      r.rating,
        'comment',     r.comment,
        'created_at',  r.created_at,
        'customer_name', cust.full_name
      ) order by r.created_at desc), '[]'::jsonb)
      from public.reviews r
      join public.profiles cust on cust.id = r.customer_id
      where r.cleaner_id = cp.user_id
      limit 20
    )
  )
  into v_result
  from public.cleaner_profiles cp
  join public.profiles          p  on p.id = cp.user_id
  join auth.users               u  on u.id = cp.user_id
  where cp.user_id = p_cleaner_id;

  if v_result is null then
    raise exception 'Cleaner not found';
  end if;

  return v_result;
end;
$$;

grant execute on function public.admin_get_cleaner_profile(uuid) to authenticated;
