-- ============================================================
-- APPLICATION STATUS CHANGE NOTIFICATIONS
-- ============================================================
-- Inserts a row into notifications when a cleaner_application
-- status changes to a state the cleaner needs to act on or
-- be informed about.
-- ============================================================

create or replace function public.notify_cleaner_on_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body  text;
begin
  -- Only fire when status actually changes
  if old.status = new.status then
    return new;
  end if;

  case new.status
    when 'under_review' then
      v_title := 'Application received';
      v_body  := 'Your application is now under review. We''ll be in touch within 2–3 business days.';

    when 'needs_info' then
      v_title := 'Changes requested';
      v_body  := coalesce(new.requested_info, 'Our team has requested some changes to your application. Please log in to review and update your documents.');

    when 'approved' then
      v_title := 'Application approved!';
      v_body  := 'Congratulations — your application has been approved. You can now access your cleaner dashboard.';

    when 'rejected' then
      v_title := 'Application not successful';
      v_body  := coalesce(new.rejection_reason, 'Unfortunately your application was not successful. Contact support if you have any questions.');

    else
      return new;
  end case;

  insert into public.notifications (user_id, type, title, body)
  values (new.cleaner_id, 'application_status', v_title, v_body);

  return new;
end;
$$;

create or replace trigger trg_application_status_notifications
after update on public.cleaner_applications
for each row
execute function public.notify_cleaner_on_application_status();
