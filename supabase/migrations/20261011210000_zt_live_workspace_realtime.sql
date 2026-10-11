-- Enable row-level-secured Postgres change events for the live company workspace.
-- Realtime still applies each table's existing RLS policies; sensitive payroll,
-- credentials, and audit tables are deliberately excluded.
do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is not available; skipping table registration';
    return;
  end if;

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
    'zt_staff_direct_messages',
    'zt_meetings',
    'zt_meeting_rsvps',
    'zt_board_items',
    'zt_performance_events',
    'zt_staff_exit_requests'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
