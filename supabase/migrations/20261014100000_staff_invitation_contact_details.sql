alter table public.zt_staff_invites
 add column if not exists email text,
 add column if not exists phone text;
create unique index if not exists zt_staff_invites_email_pending_uidx on public.zt_staff_invites(lower(email)) where status='pending' and email is not null;
