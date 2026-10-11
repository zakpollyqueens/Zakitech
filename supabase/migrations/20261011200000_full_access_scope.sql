alter table public.zt_profiles
  add column if not exists full_access boolean not null default false;

comment on column public.zt_profiles.full_access is
  'Explicit CEO-granted full workspace access, including governance board access. This does not change the account role.';
