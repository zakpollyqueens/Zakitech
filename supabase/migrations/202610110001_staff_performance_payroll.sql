-- ZakiTech staff performance and payroll foundation
create table if not exists public.zt_performance_events (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.zt_profiles(user_id) on delete cascade,
  event_type text not null check (event_type in ('customer_rating','deal','customer_acquisition','quality_review','task_review','other')),
  title text not null check (length(trim(title)) between 2 and 160),
  description text not null default '',
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  rating numeric(3,2) check (rating is null or rating between 0 and 5),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  evidence_url text,
  recorded_by uuid not null references public.zt_profiles(user_id),
  verified_by uuid references public.zt_profiles(user_id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zt_performance_events_staff_date_idx on public.zt_performance_events(staff_user_id, created_at desc);
create index if not exists zt_performance_events_status_idx on public.zt_performance_events(status, created_at desc);
create table if not exists public.zt_compensation_policies (
  id uuid primary key default gen_random_uuid(), name text not null, role_key text not null default 'all',
  currency text not null default 'UGX', base_salary numeric(14,2) not null default 0 check (base_salary >= 0),
  commission_rate numeric(7,4) not null default 0 check (commission_rate between 0 and 100),
  performance_bonus numeric(14,2) not null default 0 check (performance_bonus >= 0),
  minimum_rating numeric(3,2) not null default 0 check (minimum_rating between 0 and 5),
  pay_frequency text not null default 'monthly' check (pay_frequency in ('weekly','biweekly','monthly','custom')),
  active boolean not null default false, created_by uuid references public.zt_profiles(user_id), updated_by uuid references public.zt_profiles(user_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(role_key)
);
create table if not exists public.zt_payroll_periods (
  id uuid primary key default gen_random_uuid(), title text not null, starts_on date not null, ends_on date not null, pay_date date,
  status text not null default 'draft' check (status in ('draft','review','approved','settled','cancelled')),
  created_by uuid not null references public.zt_profiles(user_id), approved_by uuid references public.zt_profiles(user_id),
  approved_at timestamptz, settled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists zt_payroll_periods_dates_idx on public.zt_payroll_periods(starts_on desc, ends_on desc);
create table if not exists public.zt_payroll_entries (
  id uuid primary key default gen_random_uuid(), period_id uuid not null references public.zt_payroll_periods(id) on delete cascade,
  staff_user_id uuid not null references public.zt_profiles(user_id), currency text not null default 'UGX',
  base_salary numeric(14,2) not null default 0 check (base_salary >= 0), commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  performance_bonus numeric(14,2) not null default 0 check (performance_bonus >= 0), adjustments numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0, deductions numeric(14,2) not null default 0 check (deductions >= 0),
  net_amount numeric(14,2) not null default 0, calculation_notes text not null default '',
  status text not null default 'draft' check (status in ('draft','review','approved','paid','cancelled')),
  payment_provider text, payment_reference text, approved_by uuid references public.zt_profiles(user_id), approved_at timestamptz,
  paid_by uuid references public.zt_profiles(user_id), paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(period_id, staff_user_id), check (gross_amount >= 0 and net_amount >= 0)
);
create index if not exists zt_payroll_entries_staff_idx on public.zt_payroll_entries(staff_user_id, created_at desc);
create index if not exists zt_payroll_entries_period_idx on public.zt_payroll_entries(period_id, status);
alter table public.zt_performance_events enable row level security;
alter table public.zt_compensation_policies enable row level security;
alter table public.zt_payroll_periods enable row level security;
alter table public.zt_payroll_entries enable row level security;
revoke all on public.zt_performance_events, public.zt_compensation_policies, public.zt_payroll_periods, public.zt_payroll_entries from anon, authenticated;
grant all on public.zt_performance_events, public.zt_compensation_policies, public.zt_payroll_periods, public.zt_payroll_entries to service_role;
alter table public.zt_profiles drop constraint if exists zt_profiles_role_check;
alter table public.zt_profiles add constraint zt_profiles_role_check check (role = any (array['owner','vice_admin','web_developer','application_developer','engineer','staff','product_manager','project_manager','qa_tester','ui_ux_designer','devops_engineer','release_manager','notifications_manager','announcements_manager','support_officer','operations_officer','security_officer','finance_officer']::text[]));
