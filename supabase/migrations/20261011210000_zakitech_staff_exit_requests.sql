-- Staff exit requests: staff cannot self-delete; departure requires administrator approval.
create table if not exists public.zt_staff_exit_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_username text not null,
  requester_display_name text not null,
  requester_role text not null,
  letter text not null check (length(trim(letter)) between 30 and 12000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_response text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zt_staff_exit_requests_status_created_idx
  on public.zt_staff_exit_requests(status, created_at desc);
create index if not exists zt_staff_exit_requests_requester_created_idx
  on public.zt_staff_exit_requests(requester_user_id, created_at desc);
create unique index if not exists zt_staff_exit_requests_one_pending_per_user
  on public.zt_staff_exit_requests(requester_user_id)
  where requester_user_id is not null and status = 'pending';
alter table public.zt_staff_exit_requests enable row level security;
revoke all on public.zt_staff_exit_requests from anon, authenticated;
