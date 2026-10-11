alter table public.zt_board_members
  add column if not exists access_level text not null default 'board_only'
  check (access_level in ('board_only','full_workspace'));

create table if not exists public.zt_board_share_register (
  id uuid primary key default gen_random_uuid(),
  board_member_id uuid not null references public.zt_board_members(id) on delete restrict,
  share_class text not null default 'Ordinary',
  share_quantity numeric(20,4) not null check (share_quantity > 0),
  price_per_share numeric(20,4) not null check (price_per_share >= 0),
  currency text not null default 'UGX' check (currency in ('UGX','USD','KES','TZS')),
  status text not null default 'draft' check (status in ('draft','offered','accepted','paid','issued','cancelled')),
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zt_board_share_register_member_idx
  on public.zt_board_share_register(board_member_id, created_at desc);
alter table public.zt_board_share_register enable row level security;
