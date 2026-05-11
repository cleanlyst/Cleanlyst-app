-- =========================
-- RLS: SERVICES — ADMIN READ
-- =========================
-- Admins cannot currently read inactive/draft services.
-- Required for the admin dashboard to manage all service listings.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'services' and policyname = 'Admin reads all services'
  ) then
    create policy "Admin reads all services"
    on public.services
    for select
    using (public.is_admin());
  end if;
end $$;

-- =========================
-- RLS: CUSTOMER PREFERENCES — ADMIN READ
-- =========================
-- The existing is_customer() guard blocks admins from reading address data.
-- Required for support tooling and admin booking management.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'customer_preferences' and policyname = 'Admin reads customer preferences'
  ) then
    create policy "Admin reads customer preferences"
    on public.customer_preferences
    for select
    using (public.is_admin());
  end if;
end $$;

-- =========================
-- RLS: BOOKING REQUESTS — REMOVE CUSTOMER DELETE
-- =========================
-- The existing FOR ALL policy allows customers to delete booking requests.
-- A cleaner who has already viewed or responded to a request should not
-- have that record vanish. Split into targeted policies without DELETE.

drop policy if exists "Customer manages own booking requests" on public.booking_requests;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_requests' and policyname = 'Customer reads own booking requests'
  ) then
    create policy "Customer reads own booking requests"
    on public.booking_requests
    for select
    using (customer_id = auth.uid() and public.is_customer());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_requests' and policyname = 'Customer creates own booking requests'
  ) then
    create policy "Customer creates own booking requests"
    on public.booking_requests
    for insert
    with check (customer_id = auth.uid() and public.is_customer());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_requests' and policyname = 'Customer updates own booking requests'
  ) then
    create policy "Customer updates own booking requests"
    on public.booking_requests
    for update
    using (customer_id = auth.uid() and public.is_customer())
    with check (customer_id = auth.uid() and public.is_customer());
  end if;
end $$;

-- =========================
-- AUDIT INTEGRITY: ADMIN APPLICATION REVIEWS
-- =========================
-- admin_application_reviews is an append-only audit log.
-- A trigger enforces immutability at the DB level so no UPDATE or DELETE
-- can corrupt the review history, even from service-role callers.

create or replace function public.prevent_audit_log_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'admin_application_reviews is an immutable audit log and cannot be modified or deleted';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_admin_reviews_immutable'
  ) then
    create trigger trg_admin_reviews_immutable
    before update or delete on public.admin_application_reviews
    for each row execute function public.prevent_audit_log_modification();
  end if;
end $$;

-- =========================
-- SINGLETON ENFORCEMENT: PLATFORM SETTINGS
-- =========================
-- The existing constraint `check (id is not null)` does nothing.
-- This trigger prevents a second row from ever being inserted.

create or replace function public.enforce_platform_settings_singleton()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.platform_settings) then
    raise exception
      'platform_settings is a singleton table; update the existing row instead of inserting';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_platform_settings_singleton'
  ) then
    create trigger trg_platform_settings_singleton
    before insert on public.platform_settings
    for each row execute function public.enforce_platform_settings_singleton();
  end if;
end $$;

-- =========================
-- RLS: PAYMENTS — WEBHOOK SERVICE INSERT
-- =========================
-- The stripe-webhook Edge Function runs under SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS. However, payment_webhook_events currently has policies that
-- restrict insert to is_admin(). If the function ever switches to anon key
-- with a signed JWT, it would be blocked. Add a named service-role-friendly
-- policy for future proofing. Service role still bypasses RLS, so this only
-- matters for authenticated-context inserts.
-- (No change needed — service_role already bypasses; documented here for clarity.)

-- =========================
-- RLS: PAYOUTS — CLEANER INDEX SYNC
-- =========================
-- payouts.status is now an enum. The existing RLS policies reference the
-- table by name only and do not depend on the column type, so no RLS
-- changes are required for the type migration.
-- Documented here for audit trail completeness.
