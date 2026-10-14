-- ZakiTech staff onboarding, username reservations, private identity documents and attendance.
alter table public.zt_profiles
  add column if not exists address text,
  add column if not exists identity_document_number text,
  add column if not exists identity_document_path text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists legal_name text;

alter table public.zt_profiles drop constraint if exists zt_profiles_role_check;
alter table public.zt_profiles add constraint zt_profiles_role_check check (role = any (array[
  'owner','vice_admin','receptionist','web_developer','application_developer','engineer','staff',
  'product_manager','project_manager','qa_tester','ui_ux_designer','devops_engineer',
  'release_manager','notifications_manager','announcements_manager','support_officer',
  'operations_officer','security_officer','finance_officer'
]));

create table if not exists public.zt_staff_invites (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  role text not null default 'staff' check (role = any (array[
    'staff','receptionist','web_developer','application_developer','engineer','product_manager',
    'project_manager','qa_tester','ui_ux_designer','devops_engineer','release_manager',
    'notifications_manager','announcements_manager','support_officer','operations_officer',
    'security_officer','finance_officer'
  ])),
  full_access boolean not null default false,
  voucher_hash text not null unique,
  status text not null default 'pending' check (status = any (array['pending','claimed','revoked','expired'])),
  created_by uuid not null references auth.users(id) on delete restrict,
  claimed_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.zt_staff_invites
 add column if not exists workstations jsonb not null default '[]'::jsonb,
 add column if not exists product_id uuid references public.zt_products(id) on delete set null;
create unique index if not exists zt_staff_invites_username_active_idx on public.zt_staff_invites(username) where status in ('pending','claimed');
create index if not exists zt_staff_invites_status_created_idx on public.zt_staff_invites(status,created_at desc);
alter table public.zt_staff_invites enable row level security;

create table if not exists public.zt_username_pool (
  username text primary key check (username ~ '^[a-z0-9._-]{3,32}$'),
  status text not null default 'available' check (status = any (array['available','reserved','assigned','retired'])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  assigned_invite_id uuid references public.zt_staff_invites(id) on delete set null,
  assigned_at timestamptz
);
alter table public.zt_username_pool enable row level security;

alter table public.zt_workstation_assignments drop constraint if exists zt_workstation_assignments_workstation_check;
alter table public.zt_workstation_assignments add constraint zt_workstation_assignments_workstation_check check (
 workstation = any (array['product_development','release_management','notifications','announcements','support_inbox','communication'])
);

create table if not exists public.zt_attendance (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zt_profiles(user_id) on delete cascade,
 work_date date not null default current_date,
 checked_in_at timestamptz not null default now(),
 checked_out_at timestamptz,
 checkin_note text,
 checkout_note text,
 status text not null default 'checked_in' check (status = any (array['checked_in','checked_out'])),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint zt_attendance_checkout_order check (checked_out_at is null or checked_out_at >= checked_in_at),
 constraint zt_attendance_one_daily_shift unique(user_id,work_date)
);
create index if not exists zt_attendance_date_idx on public.zt_attendance(work_date desc, checked_in_at desc);
alter table public.zt_attendance enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('zt-profile-avatars','zt-profile-avatars',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('zt-staff-documents','zt-staff-documents',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];
