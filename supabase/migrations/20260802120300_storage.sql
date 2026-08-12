-- Menu PDF storage.
--
-- Menus are public information — the whole point is that a customer standing
-- outside can read one — so the bucket is public and needs no read policy.
--
-- Uploads deliberately carry no storage policies either: they go through a
-- server action holding the service role key, which checks restaurant
-- ownership first. Browsers never write to this bucket directly, so there is no
-- client-side path to guard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menus',
  'menus',
  true,
  10485760, -- 10 MB: a scanned menu that exceeds this needs compressing anyway
  array['application/pdf']
)
on conflict (id) do nothing;
