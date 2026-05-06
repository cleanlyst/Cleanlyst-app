-- Capture cleaner business names supplied during public signup.

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
    insert into public.cleaner_profiles (user_id, business_name)
    values (new.id, nullif(new.raw_user_meta_data->>'business_name', ''))
    on conflict (user_id) do update
    set business_name = coalesce(
      excluded.business_name,
      public.cleaner_profiles.business_name
    );

    insert into public.cleaner_applications (cleaner_id)
    values (new.id)
    on conflict (cleaner_id) do nothing;
  end if;

  return new;
end;
$$;
