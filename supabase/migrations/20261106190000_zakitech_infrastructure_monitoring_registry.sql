-- ZakiTech infrastructure monitoring registry
-- Provider states are recorded separately from application availability.
create table if not exists public.zt_service_monitors (
 id uuid primary key default gen_random_uuid(),
 service_key text not null unique,
 product_slug text,
 service_name text not null,
 service_type text not null check (service_type in ('application','supabase_project','cloudflare_worker','github_workflow','api_endpoint')),
 provider text not null,
 external_id text,
 health_url text,
 expected_state text not null default 'active' check (expected_state in ('active','available','enabled')),
 monitoring_enabled boolean not null default true,
 alert_on_degraded boolean not null default true,
 check_interval_minutes integer not null default 15 check (check_interval_minutes between 5 and 1440),
 last_status text not null default 'unknown' check (last_status in ('unknown','healthy','degraded','paused','unavailable','misconfigured')),
 last_checked_at timestamptz,
 last_healthy_at timestamptz,
 last_error text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.zt_service_health_checks (
 id bigint generated always as identity primary key,
 monitor_id uuid not null references public.zt_service_monitors(id) on delete cascade,
 checked_at timestamptz not null default now(),
 status text not null check (status in ('healthy','degraded','paused','unavailable','misconfigured','unknown')),
 http_status integer,
 latency_ms integer,
 message text,
 details jsonb not null default '{}'::jsonb
);
create index if not exists zt_service_health_checks_monitor_time_idx on public.zt_service_health_checks(monitor_id, checked_at desc);
alter table public.zt_service_monitors enable row level security;
alter table public.zt_service_health_checks enable row level security;
drop policy if exists "Owner reads service monitors" on public.zt_service_monitors;
create policy "Owner reads service monitors" on public.zt_service_monitors for select to authenticated using (exists(select 1 from public.zt_profiles p where p.user_id=(select auth.uid()) and p.role='owner' and p.status='active'));
drop policy if exists "Owner manages service monitors" on public.zt_service_monitors;
create policy "Owner manages service monitors" on public.zt_service_monitors for all to authenticated using (exists(select 1 from public.zt_profiles p where p.user_id=(select auth.uid()) and p.role='owner' and p.status='active')) with check (exists(select 1 from public.zt_profiles p where p.user_id=(select auth.uid()) and p.role='owner' and p.status='active'));
drop policy if exists "Owner reads service health history" on public.zt_service_health_checks;
create policy "Owner reads service health history" on public.zt_service_health_checks for select to authenticated using (exists(select 1 from public.zt_profiles p where p.user_id=(select auth.uid()) and p.role='owner' and p.status='active'));
insert into public.zt_service_monitors(service_key,product_slug,service_name,service_type,provider,external_id,health_url,metadata)
values
('ranidd-supabase','ranidd-online-mart','Ranidd Online Mart database','supabase_project','supabase','itpgyrsaseoozrkpbzew',null,'{"region":"eu-north-1"}'::jsonb),
('zakitech-supabase','zakitech','ZakiTech platform database','supabase_project','supabase','mmozesoarwkimhyloivu',null,'{"region":"eu-west-1"}'::jsonb),
('molan-business-supabase','molan-business','Molan Business database','supabase_project','supabase','rcubnewrfieqhwcnvrzs',null,'{"region":"eu-west-1"}'::jsonb),
('ranidd-web','ranidd-online-mart','Ranidd Online Mart web application','application','cloudflare','ranidd-online-shopping','https://ranidd-online-shopping.zakpollyqueens.workers.dev','{"runtime":"Cloudflare Workers"}'::jsonb)
on conflict(service_key) do update set service_name=excluded.service_name,external_id=excluded.external_id,health_url=excluded.health_url,metadata=excluded.metadata,updated_at=now();
