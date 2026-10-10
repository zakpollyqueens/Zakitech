insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('zt-build-staging','zt-build-staging',false,104857600,
 array['application/vnd.android.package-archive','application/zip','application/octet-stream','application/x-zip-compressed','application/java-archive'])
on conflict (id) do update set public=false,file_size_limit=104857600,
 allowed_mime_types=array['application/vnd.android.package-archive','application/zip','application/octet-stream','application/x-zip-compressed','application/java-archive'];

drop policy if exists "Assigned product developers upload release builds" on storage.objects;
create policy "Assigned product developers upload release builds"
on storage.objects for insert to authenticated
with check (
 bucket_id='zt-build-staging'
 and (
   exists(select 1 from public.zt_profiles p where p.user_id=auth.uid() and p.status='active' and p.role in ('owner','vice_admin'))
   or exists(
     select 1 from public.zt_profiles p
     join public.zt_workstation_assignments a on a.user_id=p.user_id
     where p.user_id=auth.uid() and p.status='active'
       and a.workstation='product_development'
       and a.product_id::text=(storage.foldername(name))[1]
   )
 )
);
