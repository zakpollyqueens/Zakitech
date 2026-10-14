alter table public.zt_staff_invites
 add column if not exists email text,
 add column if not exists phone text;
create index if not exists zt_staff_invites_email_status_idx on public.zt_staff_invites(lower(email),status) where email is not null;
