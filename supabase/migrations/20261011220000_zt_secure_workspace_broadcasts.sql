-- Use private Broadcast notifications instead of Postgres Changes.
-- The payload contains only a generic change signal; each client refetches data
-- through existing role-checked Edge Functions. Sensitive tables are excluded.
create policy "Active ZakiTech staff receive workspace change signals"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'zt-live-workspace'
  and exists (
    select 1
    from public.zt_profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  )
);

create or replace function public.zt_emit_live_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
    'workspace_changed',
    'zt-live-workspace',
    true
  );
  return null;
end;
$$;

revoke all on function public.zt_emit_live_workspace_change() from public;
revoke all on function public.zt_emit_live_workspace_change() from anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'zt_profiles',
    'zt_products',
    'zt_workstation_assignments',
    'zt_product_builds',
    'zt_announcements',
    'zt_notifications',
    'zt_product_messages',
    'zt_tasks',
    'zt_staff_messages',
    'zt_meetings',
    'zt_meeting_rsvps',
    'zt_board_items'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop trigger if exists zt_live_workspace_change on public.%I', table_name);
      execute format(
        'create trigger zt_live_workspace_change after insert or update or delete on public.%I for each row execute function public.zt_emit_live_workspace_change()',
        table_name
      );
    end if;
  end loop;

  -- The client no longer subscribes to raw row changes, so remove the tables
  -- previously registered in the Realtime publication.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'zt_profiles','zt_products','zt_workstation_assignments','zt_product_builds',
      'zt_announcements','zt_notifications','zt_product_messages','zt_tasks',
      'zt_staff_messages','zt_staff_direct_messages','zt_meetings','zt_meeting_rsvps',
      'zt_board_items','zt_performance_events','zt_staff_exit_requests'
    ] loop
      if exists (
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
