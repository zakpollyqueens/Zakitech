-- Add explicit operational blocker states so the ZakiTech delivery desk can track real blocked work.
alter table public.zt_tasks drop constraint if exists zt_tasks_status_check;
alter table public.zt_tasks
  add constraint zt_tasks_status_check
  check (status in ('assigned','in_progress','submitted','completed','cancelled','blocked','on_hold','waiting_on_external'));

create index if not exists zt_tasks_blocker_queue_idx
  on public.zt_tasks(status, priority, updated_at desc)
  where status in ('blocked','on_hold','waiting_on_external');
