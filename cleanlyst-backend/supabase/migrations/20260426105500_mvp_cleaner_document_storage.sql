-- =========================
-- STORAGE BUCKETS
-- =========================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cleaner-documents',
  'cleaner-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do nothing;

-- =========================
-- STORAGE OBJECT POLICIES
-- =========================

create policy "Cleaner uploads own onboarding docs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cleaner-documents'
  and (
    split_part(name, '/', 1) = auth.uid()::text
  )
  and public.is_cleaner()
);

create policy "Cleaner reads own onboarding docs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cleaner-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Cleaner updates own onboarding docs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cleaner-documents'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'cleaner-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Admin reads all onboarding docs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cleaner-documents'
  and public.is_admin()
);
