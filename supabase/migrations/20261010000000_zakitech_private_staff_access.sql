-- ZakiTech private staff access schema
create table if not exists public.zt_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  display_name text not null,
  role text not null default 'staff' check (role in ('owner','vice_admin','web_developer','application_developer','engineer','staff')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  must_change_password boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zt_profiles_username_format check (username ~ '^[a-zA-Z0-9._-]{3,32}$'),
  constraint zt_profiles_email_nonempty check (length(trim(email)) > 3),
  constraint zt_profiles_display_name_nonempty check (length(trim(display_name)) > 1)
);
create unique index if not exists zt_profiles_email_lower_unique on public.zt_profiles (lower(email));
create table if not exists public.zt_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.zt_profiles enable row level security;
alter table public.zt_audit_events enable row level security;
revoke all on public.zt_profiles from anon, authenticated;
grant select on public.zt_profiles to authenticated;
drop policy if exists "Staff can read their own ZakiTech profile" on public.zt_profiles;
create policy "Staff can read their own ZakiTech profile" on public.zt_profiles
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.zt_audit_events from anon, authenticated;
