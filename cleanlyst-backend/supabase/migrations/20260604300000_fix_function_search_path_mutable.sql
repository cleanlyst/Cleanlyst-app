-- ============================================================
-- FIX: function_search_path_mutable (lint=0011)
-- ============================================================
-- PostgreSQL resolves unqualified identifiers at call time using the
-- session search_path. Without a pinned search_path on the function,
-- a superuser (or a role that can SET search_path) could place a
-- shadow object earlier in the path and redirect table / type lookups.
-- Fix: add SET search_path = public to each affected function.
--
-- All five functions are BEFORE/AFTER triggers.  None is called via
-- the REST API, so no GRANT/REVOKE changes are required here.
-- Trigger wiring is unchanged — the CREATE OR REPLACE reuses the
-- existing trigger definitions in place.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. set_updated_at
--    Stamps updated_at = now() on any table that uses it.
--    No table access — only reads/writes the trigger row (NEW).
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. stamp_booking_lifecycle_timestamps
--    Sets cancelled_at when a booking transitions to 'cancelled'.
--    No table access — only reads/writes the trigger row (NEW/OLD).
-- ─────────────────────────────────────────────────────────────
create or replace function public.stamp_booking_lifecycle_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'cancelled' and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. stamp_cleaner_approval_date
--    Sets approval_date when cleaner_profiles.status → 'approved'.
--    No table access — only reads/writes the trigger row (NEW/OLD).
-- ─────────────────────────────────────────────────────────────
create or replace function public.stamp_cleaner_approval_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'approved' then
    new.approval_date := now();
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. prevent_audit_log_modification
--    Blocks any UPDATE or DELETE on admin_application_reviews.
--    No table access — raises an exception unconditionally.
-- ─────────────────────────────────────────────────────────────
create or replace function public.prevent_audit_log_modification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception
    'admin_application_reviews is an immutable audit log and cannot be modified or deleted';
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. enforce_platform_settings_singleton
--    Prevents a second row from being inserted into platform_settings.
--    Table reference already fully qualified as public.platform_settings.
-- ─────────────────────────────────────────────────────────────
create or replace function public.enforce_platform_settings_singleton()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.platform_settings) then
    raise exception
      'platform_settings is a singleton table; update the existing row instead of inserting';
  end if;
  return new;
end;
$$;
