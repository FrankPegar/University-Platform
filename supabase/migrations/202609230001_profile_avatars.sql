-- Coursepoint v1.2. Apply once using the project's SQL editor or migration runner.
-- No existing profile fields, profile RLS policies, or other buckets are changed.
begin;

alter table public.profiles add column if not exists avatar_path text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_avatar_path_own_object') then
    alter table public.profiles add constraint profiles_avatar_path_own_object
      check (avatar_path is null or avatar_path = id::text || '/avatar.webp');
  end if;
end $$;

-- App uploads JPEG/PNG/WebP, validates/decodes them, then stores a static WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage writes in Express use the verified student's JWT, so these policies
-- apply to app requests as well as direct Storage requests. Exact object names
-- allow at most one current image per student, including across format changes.
drop policy if exists coursepoint_avatars_read on storage.objects;
create policy coursepoint_avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
drop policy if exists coursepoint_avatars_insert on storage.objects;
create policy coursepoint_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');
drop policy if exists coursepoint_avatars_update on storage.objects;
create policy coursepoint_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');
drop policy if exists coursepoint_avatars_delete on storage.objects;
create policy coursepoint_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');

-- Restrictive guards prevent unrelated, permissive Storage policies from
-- accidentally granting cross-student writes to this bucket. Other buckets
-- retain their existing behavior.
drop policy if exists coursepoint_avatars_insert_guard on storage.objects;
create policy coursepoint_avatars_insert_guard on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'avatars' or name = (select auth.uid())::text || '/avatar.webp');
drop policy if exists coursepoint_avatars_update_guard on storage.objects;
create policy coursepoint_avatars_update_guard on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'avatars' or name = (select auth.uid())::text || '/avatar.webp')
  with check (bucket_id <> 'avatars' or name = (select auth.uid())::text || '/avatar.webp');
drop policy if exists coursepoint_avatars_delete_guard on storage.objects;
create policy coursepoint_avatars_delete_guard on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'avatars' or name = (select auth.uid())::text || '/avatar.webp');
drop policy if exists coursepoint_avatars_anon_guard on storage.objects;
create policy coursepoint_avatars_anon_guard on storage.objects as restrictive for all to anon
  using (bucket_id <> 'avatars') with check (bucket_id <> 'avatars');

notify pgrst, 'reload schema';
commit;
