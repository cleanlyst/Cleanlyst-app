-- =========================
-- NOTIFICATIONS
-- =========================
-- In-app notification store. Automated inserts happen via Edge Functions or
-- database triggers running under service role (which bypasses RLS).
-- Authenticated inserts are admin-only.

create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  type       text        not null,
  title      text        not null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users read their own notifications.
create policy "Users read own notifications"
on public.notifications
for select
using (user_id = auth.uid());

-- Users can mark their own notifications as read (update read_at).
create policy "Users update own notifications"
on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Admin full access for support tooling and manual notifications.
create policy "Admin manages notifications"
on public.notifications
for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- NOTIFICATIONS: INDEXES
-- =========================

-- Efficient unread badge count per user.
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- General per-user notification feed.
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
