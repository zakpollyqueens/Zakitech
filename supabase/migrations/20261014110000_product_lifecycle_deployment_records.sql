-- Track verifiable product deployments separately from the product's marketing website.
alter table public.zt_products
 add column if not exists deployment_url text,
 add column if not exists deployed_at timestamptz,
 add column if not exists deployed_by uuid references public.zt_profiles(user_id) on delete set null;
create index if not exists zt_products_deployed_at_idx on public.zt_products(deployed_at desc) where deployed_at is not null;
