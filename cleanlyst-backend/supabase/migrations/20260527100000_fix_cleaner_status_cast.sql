-- ============================================================
-- FIX: admin_review_cleaner_application — cleaner_status cast
-- ============================================================
-- The original RPC set cleaner_profiles.status from bare text
-- literals ('approved', 'pending') in a CASE expression.
-- PostgreSQL cannot implicitly coerce text to the cleaner_status
-- enum, producing:
--   "column status is of type cleaner_status but expression is of type text"
-- Fix: add explicit ::public.cleaner_status casts.
-- ============================================================

create or replace function public.admin_review_cleaner_application(
  p_application_id uuid,
  p_action public.application_status,
  p_notes text default null,
  p_requested_info text default null
)
returns public.cleaner_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.cleaner_applications;
  v_new_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review applications';
  end if;

  if p_action not in ('approved', 'rejected', 'needs_info') then
    raise exception 'Invalid review action';
  end if;

  update public.cleaner_applications
  set
    status      = p_action,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = case when p_action = 'rejected'   then coalesce(p_notes, 'Rejected by admin') else null end,
    requested_info   = case when p_action = 'needs_info' then p_requested_info                         else null end
  where id = p_application_id
    and status in ('submitted', 'under_review', 'needs_info')
  returning * into v_application;

  if v_application.id is null then
    raise exception 'Application not found or cannot be reviewed';
  end if;

  insert into public.admin_application_reviews (
    application_id,
    cleaner_id,
    admin_id,
    action,
    notes,
    requested_fields
  ) values (
    v_application.id,
    v_application.cleaner_id,
    auth.uid(),
    p_action,
    p_notes,
    case when p_requested_info is null then null
         else jsonb_build_object('summary', p_requested_info)
    end
  );

  v_new_role := case
    when p_action = 'approved' then 'cleaner_active'::public.user_role
    else                            'cleaner_pending'::public.user_role
  end;

  update public.profiles
  set role = v_new_role
  where id = v_application.cleaner_id;

  -- Explicit ::public.cleaner_status casts required — bare text literals
  -- cannot be implicitly coerced to enum types in CASE expressions.
  update public.cleaner_profiles
  set
    status            = case when p_action = 'approved'
                             then 'approved'::public.cleaner_status
                             else 'pending'::public.cleaner_status
                        end,
    onboarding_complete = (p_action = 'approved')
  where user_id = v_application.cleaner_id;

  return v_application;
end;
$$;
