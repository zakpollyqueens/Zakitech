-- Add an explicit Created lifecycle state before active development.
alter table public.zt_products drop constraint if exists zt_products_status_check;
alter table public.zt_products add constraint zt_products_status_check
 check (status = any (array['planned','created','in_development','in_review','launched','paused','archived']));
