-- ============================================================
-- STORAGE RLS — cleaner-documents bucket
-- ============================================================
-- Path convention: {userId}/{applicationId}/{documentType}/{timestamp}-{filename}
-- The first path component is always the uploader's user ID.
-- ============================================================

-- Cleaners can upload their own documents (first folder = their uid)
create policy "Cleaner uploads own documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cleaner-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Cleaners can replace/update their own documents
create policy "Cleaner updates own documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cleaner-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'cleaner-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Cleaners can read their own documents
create policy "Cleaner reads own documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cleaner-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all documents for review
create policy "Admin reads cleaner documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cleaner-documents'
  and public.is_admin()
);
