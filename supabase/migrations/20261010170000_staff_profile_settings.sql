-- ZakiTech staff profile, private avatar storage, and confirmed-email synchronization.
alter table public.zt_profiles
  add column if not exists phone text,
  add column if not exists avatar_path text;

create or replace function public.sync_zt_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.zt_profiles
       set email = new.email, updated_at = now()
     where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_zt_profile_email() from public, anon, authenticated;
drop trigger if exists sync_zt_profile_email_after_auth_update on auth.users;
create trigger sync_zt_profile_email_after_auth_update
after update of email on auth.users
for each row execute function public.sync_zt_profile_email();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zt-profile-avatars', 'zt-profile-avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Active staff can view active staff avatars" on storage.objects;
create policy "Active staff can view active staff avatars"
on storage.objects for select to authenticated
using (bucket_id = 'zt-profile-avatars' and exists (
  select 1 from public.zt_profiles p
  where p.user_id = (select auth.uid()) and p.status = 'active'
));

drop policy if exists "Staff can upload their own avatar" on storage.objects;
create policy "Staff can upload their own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'zt-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.zt_profiles p where p.user_id = (select auth.uid()) and p.status = 'active'));

drop policy if exists "Staff can update their own avatar" on storage.objects;
create policy "Staff can update their own avatar"
on storage.objects for update to authenticated
using (bucket_id = 'zt-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.zt_profiles p where p.user_id = (select auth.uid()) and p.status = 'active'))
with check (bucket_id = 'zt-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.zt_profiles p where p.user_id = (select auth.uid()) and p.status = 'active'));

drop policy if exists "Staff can delete their own avatar" on storage.objects;
create policy "Staff can delete their own avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'zt-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.zt_profiles p where p.user_id = (select auth.uid()) and p.status = 'active'));
