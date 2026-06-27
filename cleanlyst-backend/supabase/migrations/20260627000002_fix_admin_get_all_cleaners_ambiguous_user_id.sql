-- =============================================================================
-- FIX: admin_get_all_cleaners — "column reference user_id is ambiguous"
-- =============================================================================
-- admin_get_all_cleaners declares RETURNS TABLE (user_id uuid, ...), which
-- makes "user_id" a PL/pgSQL OUT parameter visible throughout the function
-- body.  The three sub-queries inside RETURN QUERY use:
--
--   SELECT user_id FROM base
--
-- PostgreSQL's variable_conflict = error (the default) sees BOTH the CTE
-- column base.user_id AND the OUT parameter user_id in scope, and raises
-- "column reference 'user_id' is ambiguous".
--
-- Fix: qualify each sub-query reference as base.user_id to remove the
-- ambiguity.  No business logic changes.
-- =============================================================================

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
        or p.full_name      ilike '%' || p_search || '%'
        or u.email          ilike '%' || p_search || '%'
        or p.city           ilike '%' || p_search || '%'
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
    where b.cleaner_id in (select base.user_id from base)
    group by b.cleaner_id
  ),
  avail as (
    select distinct cleaner_id
    from public.availability_slots
    where cleaner_id in (select base.user_id from base)
  ),
  docs as (
    select
      ca.cleaner_id,
      bool_and(coalesce(cad.admin_verified, false)) as all_verified
    from public.cleaner_applications     ca
    join public.cleaner_application_documents cad on cad.application_id = ca.id
    where ca.cleaner_id in (select base.user_id from base)
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
  left join stats    s on s.cleaner_id = b.user_id
  left join avail    a on a.cleaner_id = b.user_id
  left join docs     d on d.cleaner_id = b.user_id
  order by b.joined_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

grant execute on function public.admin_get_all_cleaners(text, text, integer, integer) to authenticated;
