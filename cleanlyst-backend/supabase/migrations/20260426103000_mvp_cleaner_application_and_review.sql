-- =========================
-- CLEANER APPLICATION TYPES
-- =========================

do $$ begin
  create type public.application_step as enum (
    'personal_details',
    'documents',
    'dbs',
    'insurance',
    'submitted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'needs_info'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum (
    'id_document',
    'dbs_document',
    'insurance_document'
  );
exception when duplicate_object then null; end $$;

-- =========================
-- CLEANER APPLICATION TABLES
-- =========================

create table if not exists public.cleaner_applications (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.application_status not null default 'draft',
  current_step public.application_step not null default 'personal_details',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text,
  requested_info text,
  personal_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_cleaner_applications_updated_at
before update on public.cleaner_applications
for each row execute function public.set_updated_at();

create table if not exists public.cleaner_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cleaner_applications(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  document_type public.document_type not null,
  file_path text not null,
  mime_type text,
  file_size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  admin_verified boolean not null default false,
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  constraint cleaner_documents_unique_type unique (application_id, document_type)
);

create index idx_cleaner_documents_cleaner on public.cleaner_application_documents(cleaner_id);

create table if not exists public.admin_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cleaner_applications(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid not null references public.profiles(id),
  action public.application_status not null,
  notes text,
  requested_fields jsonb,
  created_at timestamptz not null default now()
);

create index idx_admin_reviews_application on public.admin_application_reviews(application_id);

-- =========================
-- RLS
-- =========================

alter table public.cleaner_applications enable row level security;
alter table public.cleaner_application_documents enable row level security;
alter table public.admin_application_reviews enable row level security;

create policy "Cleaner reads own application"
on public.cleaner_applications
for select
using (cleaner_id = auth.uid());

create policy "Cleaner inserts own application"
on public.cleaner_applications
for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());

create policy "Cleaner updates own draft application"
on public.cleaner_applications
for update
using (cleaner_id = auth.uid() and status in ('draft', 'needs_info'))
with check (cleaner_id = auth.uid());

create policy "Admin reads all applications"
on public.cleaner_applications
for select
using (public.is_admin());

create policy "Admin updates applications"
on public.cleaner_applications
for update
using (public.is_admin())
with check (public.is_admin());

create policy "Cleaner reads own docs"
on public.cleaner_application_documents
for select
using (cleaner_id = auth.uid());

create policy "Cleaner upserts own docs"
on public.cleaner_application_documents
for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());

create policy "Cleaner edits own docs before approval"
on public.cleaner_application_documents
for update
using (
  cleaner_id = auth.uid()
  and exists (
    select 1
    from public.cleaner_applications a
    where a.id = cleaner_application_documents.application_id
      and a.cleaner_id = auth.uid()
      and a.status in ('draft', 'needs_info')
  )
)
with check (cleaner_id = auth.uid());

create policy "Admin reads cleaner docs"
on public.cleaner_application_documents
for select
using (public.is_admin());

create policy "Admin reviews cleaner docs"
on public.cleaner_application_documents
for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admin creates review log"
on public.admin_application_reviews
for insert
with check (public.is_admin() and admin_id = auth.uid());

create policy "Admin reads review log"
on public.admin_application_reviews
for select
using (public.is_admin());

create policy "Cleaner reads own review log"
on public.admin_application_reviews
for select
using (cleaner_id = auth.uid());

-- =========================
-- REVIEW RPCS
-- =========================

create or replace function public.submit_cleaner_application(p_application_id uuid)
returns public.cleaner_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.cleaner_applications;
begin
  update public.cleaner_applications
  set
    status = 'submitted',
    current_step = 'submitted',
    submitted_at = now(),
    reviewed_by = null,
    reviewed_at = null,
    rejection_reason = null
  where id = p_application_id
    and cleaner_id = auth.uid()
    and status in ('draft', 'needs_info')
  returning * into v_application;

  if v_application.id is null then
    raise exception 'Application not found or not editable';
  end if;

  return v_application;
end;
$$;

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
    status = p_action,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = case when p_action = 'rejected' then coalesce(p_notes, 'Rejected by admin') else null end,
    requested_info = case when p_action = 'needs_info' then p_requested_info else null end
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
  )
  values (
    v_application.id,
    v_application.cleaner_id,
    auth.uid(),
    p_action,
    p_notes,
    case when p_requested_info is null then null else jsonb_build_object('summary', p_requested_info) end
  );

  v_new_role := case
    when p_action = 'approved' then 'cleaner_active'
    else 'cleaner_pending'
  end;

  update public.profiles
  set role = v_new_role
  where id = v_application.cleaner_id;

  update public.cleaner_profiles
  set
    status = case when p_action = 'approved' then 'approved' else 'pending' end,
    onboarding_complete = (p_action = 'approved')
  where user_id = v_application.cleaner_id;

  return v_application;
end;
$$;
