-- =============================================================================
-- FIX: prevent_ledger_mutation trigger — two bugs
-- =============================================================================
-- Bug 1: The function was SECURITY DEFINER, so current_user was always
--   'postgres' (the trigger owner) regardless of the actual caller. The
--   service_role bypass check (current_user in ('service_role', ...)) was
--   always FALSE, making the trigger unconditionally block all deletes.
--
-- Bug 2: The bypass returned `new` instead of `old`. For BEFORE DELETE
--   triggers, NEW is NULL; returning NULL cancels the delete. So even if the
--   role check had worked, the bypass would have accidentally blocked the delete.
--
-- Fix: Remove SECURITY DEFINER so current_user reflects the actual session role.
--   Change `return new` → `return old` to allow the delete when bypassed.

create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
-- NOT security definer: current_user now reflects the actual session role so
-- the service_role bypass below works correctly.
set search_path = public
as $$
begin
  -- service_role and supabase_admin are allowed to delete ledger rows
  -- (used for test cleanup and emergency admin corrections — audit manually).
  if current_user in ('service_role', 'supabase_admin') then
    return old;  -- BEFORE DELETE: returning old (non-null) proceeds with the delete
  end if;

  raise exception
    'payment_ledger_events is append-only. UPDATE and DELETE are forbidden. '
    'Financial history must never be mutated. (caller role: %)', current_user;
end;
$$;

-- No need to re-create the trigger; it still references prevent_ledger_mutation().
-- But revoke/grant must stay in sync.
revoke execute on function public.prevent_ledger_mutation() from public, anon, authenticated;
