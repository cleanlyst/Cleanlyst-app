-- Fix admin_get_cleaner_profile: services subquery referenced s.base_price_pence
-- (column does not exist; actual column is base_price_cents per init schema).
-- Replaces the function with the corrected column reference.

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
        'id',               s.id,
        'title',            s.title,
        'category',         s.category,
        'description',      s.description,
        'base_price_cents', s.base_price_cents,
        'duration_minutes', s.duration_minutes,
        'active',           s.active
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
        'id',             cad.id,
        'document_type',  cad.document_type,
        'file_path',      cad.file_path,
        'mime_type',      cad.mime_type,
        'uploaded_at',    cad.uploaded_at,
        'admin_verified', cad.admin_verified
      ) order by cad.document_type), '[]'::jsonb)
      from public.cleaner_application_documents cad
      join public.cleaner_applications ca on ca.id = cad.application_id
      where ca.cleaner_id = cp.user_id
    ),
    'reviews', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',            r.id,
        'rating',        r.rating,
        'comment',       r.comment,
        'created_at',    r.created_at,
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
