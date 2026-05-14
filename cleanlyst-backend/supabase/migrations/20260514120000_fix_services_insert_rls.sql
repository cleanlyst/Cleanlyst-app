-- Allow both cleaner_pending and cleaner_active users to create their own services.
-- Pending cleaners can pre-populate their service list before approval;
-- services only become publicly visible once the cleaner is approved (via the
-- "Public can view active services" SELECT policy which gates on cleaner status
-- through the SearchCleaner query's status='approved' filter).

drop policy if exists "Cleaner inserts own services" on public.services;

create policy "Cleaner inserts own services"
on public.services for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());
