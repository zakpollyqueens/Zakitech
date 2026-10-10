-- Restrict audit reads to active company administrators and index foreign keys.
create index if not exists zt_profiles_created_by_idx on public.zt_profiles(created_by);
create index if not exists zt_audit_events_actor_user_id_idx on public.zt_audit_events(actor_user_id);
create index if not exists zt_audit_events_target_user_id_idx on public.zt_audit_events(target_user_id);
grant select on public.zt_audit_events to authenticated;
drop policy if exists "Admins can read ZakiTech audit events" on public.zt_audit_events;
create policy "Admins can read ZakiTech audit events"
on public.zt_audit_events for select to authenticated
using (exists (
  select 1 from public.zt_profiles p
  where p.user_id = (select auth.uid())
    and p.status = 'active'
    and p.role in ('owner','vice_admin')
));
