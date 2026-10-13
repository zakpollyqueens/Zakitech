alter table public.zt_staff_exit_requests
  drop constraint if exists zt_staff_exit_requests_status_check;
alter table public.zt_staff_exit_requests
  add constraint zt_staff_exit_requests_status_check
  check (status in ('pending','processing','approved','rejected'));