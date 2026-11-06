create table if not exists public.zt_payment_invoices (
  id uuid primary key default gen_random_uuid(),
  public_token_hash text not null unique,
  invoice_number text not null unique,
  product_name text not null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  currency_code text not null default 'UGX',
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null check (subtotal > 0),
  total_amount numeric(14,2) not null check (total_amount > 0),
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft','pending','creating','paid','failed','cancelled','expired')),
  provider text not null default 'jjuma',
  provider_reference text unique,
  checkout_url text,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  paid_at timestamptz,
  verified_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.zt_payment_invoices add column if not exists public_token text;
create unique index if not exists zt_payment_invoices_public_token_idx on public.zt_payment_invoices(public_token) where public_token is not null;
create index if not exists zt_payment_invoices_created_at_idx on public.zt_payment_invoices(created_at desc);
create index if not exists zt_payment_invoices_status_idx on public.zt_payment_invoices(status);
create index if not exists zt_payment_invoices_created_by_idx on public.zt_payment_invoices(created_by);
alter table public.zt_payment_invoices enable row level security;
revoke all on public.zt_payment_invoices from anon, authenticated;
comment on table public.zt_payment_invoices is 'ZakiTech managed customer invoices; public links reveal only invoice-safe fields and payment is verified by signed Jjuma webhook.';
