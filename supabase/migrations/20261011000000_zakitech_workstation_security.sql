-- Per-user workstation passcodes. Never expose verifier material to browser clients.
create table if not exists public.zt_workstation_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credential_type text not null default 'pin' check (credential_type in ('pin','password')),
  passcode_salt text not null,
  passcode_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.zt_workstation_credentials enable row level security;
revoke all on public.zt_workstation_credentials from anon, authenticated;
comment on table public.zt_workstation_credentials is 'Server-only salted PBKDF2 verifiers and rate-limit state for workstation passcodes. Access only through zakitech-workstation-security Edge Function.';
