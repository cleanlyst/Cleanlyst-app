-- Pre-launch waitlist: email-only signups (no Auth). Inserts go through submit_waitlist_signup() only.

create extension if not exists citext;

do $$ begin
  create type public.waitlist_interest_type as enum ('customer', 'cleaner', 'unknown');
exception when duplicate_object then null; end $$;

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),

  email public.citext not null,
  email_normalized public.citext generated always as (lower(trim(email::text))::public.citext) stored,

  interest_type public.waitlist_interest_type not null default 'unknown',

  consent_launch_notifications boolean not null default false,
  consent_recorded_at timestamptz not null default now(),
  consent_privacy_version text not null,

  marketing_opt_out_at timestamptz,

  invited_at timestamptz,
  invite_channel text,

  converted_user_id uuid references auth.users (id) on delete set null,
  converted_at timestamptz,

  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint waitlist_signups_email_nonempty check (length(trim(email::text)) > 0),
  constraint waitlist_signups_consent_required check (consent_launch_notifications = true)
);

create unique index waitlist_signups_email_normalized_uidx
  on public.waitlist_signups (email_normalized);

create index waitlist_signups_interest_idx on public.waitlist_signups (interest_type);
create index waitlist_signups_invited_idx on public.waitlist_signups (invited_at);
create index waitlist_signups_converted_idx on public.waitlist_signups (converted_at);

create trigger trg_waitlist_signups_updated_at
before update on public.waitlist_signups
for each row execute function public.set_updated_at();

alter table public.waitlist_signups enable row level security;

revoke all on table public.waitlist_signups from public;
revoke all on table public.waitlist_signups from anon, authenticated;

create or replace function public.submit_waitlist_signup(
  p_email text,
  p_interest public.waitlist_interest_type,
  p_consent boolean,
  p_privacy_version text,
  p_source_path text default null
)
returns table (
  status text,
  id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email public.citext;
  v_id uuid;
begin
  if p_consent is distinct from true then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if p_privacy_version is null or length(trim(p_privacy_version)) = 0 then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  v_email := nullif(trim(p_email), '')::public.citext;
  if v_email is null then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if v_email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  v_id := null;

  insert into public.waitlist_signups (
    email,
    interest_type,
    consent_launch_notifications,
    consent_privacy_version,
    source_path
  )
  values (
    v_email,
    coalesce(p_interest, 'unknown'),
    true,
    trim(p_privacy_version),
    nullif(trim(p_source_path), '')
  )
  on conflict (email_normalized) do nothing
  returning waitlist_signups.id into v_id;

  if v_id is not null then
    return query select 'created'::text, v_id;
    return;
  end if;

  return query select 'duplicate'::text, null::uuid;
end;
$$;

revoke all on function public.submit_waitlist_signup(text, public.waitlist_interest_type, boolean, text, text) from public;
grant execute on function public.submit_waitlist_signup(text, public.waitlist_interest_type, boolean, text, text) to anon, authenticated;

grant usage on type public.waitlist_interest_type to anon, authenticated;

comment on table public.waitlist_signups is 'Pre-launch waitlist emails; no Auth users. Writes via submit_waitlist_signup RPC only.';
comment on function public.submit_waitlist_signup(text, public.waitlist_interest_type, boolean, text, text) is 'Public waitlist signup; returns status created|duplicate|invalid.';
