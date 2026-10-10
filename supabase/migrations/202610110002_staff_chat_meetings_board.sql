-- ZakiTech meetings, private staff messaging, and governance board
create table if not exists public.zt_staff_direct_messages (
 id uuid primary key default gen_random_uuid(),
 sender_user_id uuid not null references public.zt_profiles(user_id) on delete cascade,
 recipient_user_id uuid not null references public.zt_profiles(user_id) on delete cascade,
 body text not null check (length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 check (sender_user_id <> recipient_user_id)
);
create index if not exists zt_staff_dm_sender_idx on public.zt_staff_direct_messages(sender_user_id, created_at desc);
create index if not exists zt_staff_dm_recipient_idx on public.zt_staff_direct_messages(recipient_user_id, created_at desc);
create table if not exists public.zt_meetings (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 2 and 180),
 description text not null default '',
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 join_url text,
 provider text not null default 'zoom' check (provider in ('zoom','google_meet','other')),
 audience text not null default 'all_staff' check (audience in ('all_staff','board','admins')),
 status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
 created_by uuid not null references public.zt_profiles(user_id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ends_at > starts_at)
);
create index if not exists zt_meetings_starts_idx on public.zt_meetings(starts_at);
create table if not exists public.zt_meeting_rsvps (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid not null references public.zt_meetings(id) on delete cascade,
 user_id uuid not null references public.zt_profiles(user_id) on delete cascade,
 response text not null check (response in ('attending','maybe','declined')),
 updated_at timestamptz not null default now(),
 unique(meeting_id,user_id)
);
create table if not exists public.zt_board_members (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.zt_profiles(user_id) on delete cascade,
 board_title text not null default 'Board Member',
 added_by uuid not null references public.zt_profiles(user_id),
 created_at timestamptz not null default now()
);
create table if not exists public.zt_board_items (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 2 and 180),
 body text not null,
 item_type text not null check (item_type in ('update','agenda','resolution','minutes','document')),
 document_url text,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_by uuid not null references public.zt_profiles(user_id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists zt_board_items_status_date_idx on public.zt_board_items(status,created_at desc);
alter table public.zt_staff_direct_messages enable row level security;
alter table public.zt_meetings enable row level security;
alter table public.zt_meeting_rsvps enable row level security;
alter table public.zt_board_members enable row level security;
alter table public.zt_board_items enable row level security;
revoke all on public.zt_staff_direct_messages,public.zt_meetings,public.zt_meeting_rsvps,public.zt_board_members,public.zt_board_items from anon,authenticated;
grant all on public.zt_staff_direct_messages,public.zt_meetings,public.zt_meeting_rsvps,public.zt_board_members,public.zt_board_items to service_role;
