create extension if not exists pgcrypto;

create table if not exists public.zt_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  repository_url text,
  website_url text,
  admin_center_url text,
  current_version text,
  status text not null default 'planned' check (status in ('planned','in_development','in_review','launched','paused','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zt_workstation_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zt_profiles(user_id) on delete cascade,
  workstation text not null check (workstation in ('product_development','release_management','notifications','announcements','support_inbox')),
  product_id uuid references public.zt_products(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint zt_workstation_product_scope check (
    (workstation in ('product_development','release_management') and product_id is not null)
    or (workstation in ('notifications','announcements','support_inbox') and product_id is null)
  )
);
create unique index if not exists zt_workstation_assignment_unique
on public.zt_workstation_assignments(user_id, workstation, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.zt_product_builds (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.zt_products(id) on delete cascade,
  version text not null check (length(trim(version)) between 1 and 40),
  title text not null check (length(trim(title)) between 2 and 140),
  description text not null default '',
  release_notes text not null default '',
  channel text not null default 'stable' check (channel in ('stable','beta','testing')),
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  status text not null default 'submitted' check (status in ('draft','submitted','approved','published','rejected','archived')),
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, version, channel)
);

create table if not exists public.zt_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  body text not null check (length(trim(body)) between 2 and 8000),
  audience text not null default 'staff' check (audience in ('staff','all_company')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zt_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.zt_products(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 160),
  body text not null check (length(trim(body)) between 2 and 5000),
  notification_type text not null default 'general' check (notification_type in ('general','update','maintenance','security','announcement')),
  audience text not null default 'product_users' check (audience in ('product_users','staff','all_company')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zt_product_messages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.zt_products(id) on delete cascade,
  external_message_id text,
  sender_name text not null default 'ZakiChat user',
  sender_email text,
  subject text not null default 'Product feedback',
  message text not null check (length(trim(message)) between 1 and 10000),
  source text not null default 'manual' check (source in ('manual','zaki_chat','webhook')),
  status text not null default 'new' check (status in ('new','in_progress','resolved','closed')),
  assigned_to uuid references public.zt_profiles(user_id) on delete set null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists zt_product_messages_external_unique
on public.zt_product_messages(product_id, external_message_id) where external_message_id is not null;

create table if not exists public.zt_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  description text not null default '',
  product_id uuid references public.zt_products(id) on delete set null,
  assigned_to uuid not null references public.zt_profiles(user_id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'assigned' check (status in ('assigned','in_progress','submitted','completed','cancelled')),
  due_at timestamptz,
  submission_note text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zt_products enable row level security;
alter table public.zt_workstation_assignments enable row level security;
alter table public.zt_product_builds enable row level security;
alter table public.zt_announcements enable row level security;
alter table public.zt_notifications enable row level security;
alter table public.zt_product_messages enable row level security;
alter table public.zt_tasks enable row level security;

insert into public.zt_products
(slug,name,description,repository_url,website_url,admin_center_url,current_version,status)
values
('zakichat','ZakiChat','The first messaging product developed by Zakmolanitech Solutions. Manage development builds, release reviews, published versions, notifications and user feedback through assigned workstations.','https://github.com/zakpollyqueens/ZakiChat-',null,null,'zc-vr15','in_development')
on conflict (slug) do update set
 name=excluded.name,
 description=excluded.description,
 repository_url=excluded.repository_url,
 website_url=excluded.website_url,
 admin_center_url=excluded.admin_center_url,
 current_version=coalesce(public.zt_products.current_version,excluded.current_version),
 updated_at=now();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('zt-product-releases','zt-product-releases',true,104857600,
 array['application/vnd.android.package-archive','application/zip','application/octet-stream','application/x-zip-compressed','application/java-archive'])
on conflict (id) do update set public=true,file_size_limit=104857600,
 allowed_mime_types=array['application/vnd.android.package-archive','application/zip','application/octet-stream','application/x-zip-compressed','application/java-archive'];

drop policy if exists "Assigned product developers upload release builds" on storage.objects;
create policy "Assigned product developers upload release builds"
on storage.objects for insert to authenticated
with check (
 bucket_id='zt-product-releases'
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
