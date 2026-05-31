-- ============================================================
-- Migration 008: Make ilm-assets bucket public
-- ============================================================
-- BUG FIX: The app uploads student photos and school logos to the
-- `ilm-assets` bucket, then calls getPublicUrl() to render them in
-- <img> tags and printable pages. But the bucket was created with
-- public = false, so those URLs returned 403 and images never showed.
--
-- Fix: flip the bucket to public. Paths are already namespaced by
-- school_id (e.g. `${schoolId}/students/...`). Public read is the
-- pragmatic choice for an MVP — signed URLs would expire and break
-- the printable report cards / ID cards / PWA caching.

update storage.buckets set public = true where id = 'ilm-assets';

-- Allow public (anon) read of objects in this bucket so <img> tags work
-- without an auth header (needed for print pages opened in new tabs).
drop policy if exists "ilm-assets: public read" on storage.objects;
create policy "ilm-assets: public read" on storage.objects
  for select using (bucket_id = 'ilm-assets');
