# Waitlist operations (MVP)

Pre-launch emails live in `public.waitlist_signups`. There is **no** Supabase Auth user for these rows. Submissions from the app use the RPC `public.submit_waitlist_signup` only.

## Export (manual outreach)

In the Supabase SQL editor (service role / postgres), run:

```sql
select
  email::text,
  interest_type,
  consent_recorded_at,
  consent_privacy_version,
  invited_at,
  converted_at,
  marketing_opt_out_at
from public.waitlist_signups
where marketing_opt_out_at is null
order by created_at asc;
```

Optional filters:

- Not yet invited: `and invited_at is null`
- Customers only: `and interest_type = 'customer'`

## Mark as invited (after you send a manual email)

```sql
update public.waitlist_signups
set
  invited_at = now(),
  invite_channel = 'manual_email'
where email_normalized = lower(trim('user@example.com'))::citext;
```

## Record marketing opt-out (GDPR withdrawal)

```sql
update public.waitlist_signups
set marketing_opt_out_at = now()
where email_normalized = lower(trim('user@example.com'))::citext;
```

Do **not** email addresses where `marketing_opt_out_at is not null`.

## Mark conversion (after real signup)

When the person completes the real signup flow and you can match them (e.g. same email in `auth.users`):

```sql
update public.waitlist_signups
set
  converted_user_id = '<auth_user_uuid>',
  converted_at = now()
where email_normalized = lower(trim('user@example.com'))::citext;
```

Match `auth.users.email` to the waitlist row in your admin process if needed.

## Intent query parameter

The Coming Soon page passes `?intent=customer` or `?intent=cleaner` into `interest_type` (otherwise `unknown`). Use this in links from marketing pages if you want segmentation.
