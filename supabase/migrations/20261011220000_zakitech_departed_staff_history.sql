-- Preserve company history when an approved departure deletes the staff auth/profile record.
-- Former-user attribution becomes NULL where appropriate rather than blocking account removal.
do $$
declare
  item record;
  constraint_row record;
begin
  for item in
    select * from (values
      ('public.zt_board_items','created_by','public.zt_profiles','user_id'),
      ('public.zt_board_members','added_by','public.zt_profiles','user_id'),
      ('public.zt_compensation_policies','created_by','public.zt_profiles','user_id'),
      ('public.zt_compensation_policies','updated_by','public.zt_profiles','user_id'),
      ('public.zt_meetings','created_by','public.zt_profiles','user_id'),
      ('public.zt_payroll_entries','approved_by','public.zt_profiles','user_id'),
      ('public.zt_payroll_entries','paid_by','public.zt_profiles','user_id'),
      ('public.zt_payroll_entries','staff_user_id','public.zt_profiles','user_id'),
      ('public.zt_payroll_periods','approved_by','public.zt_profiles','user_id'),
      ('public.zt_payroll_periods','created_by','public.zt_profiles','user_id'),
      ('public.zt_performance_events','recorded_by','public.zt_profiles','user_id'),
      ('public.zt_performance_events','verified_by','public.zt_profiles','user_id'),
      ('public.zt_performance_events','staff_user_id','public.zt_profiles','user_id'),
      ('public.zt_staff_messages','sender_id','public.zt_profiles','user_id'),
      ('public.zt_tasks','assigned_to','public.zt_profiles','user_id'),
      ('public.zt_tasks','created_by','auth.users','id'),
      ('public.zt_board_share_register','created_by','auth.users','id'),
      ('public.zt_board_share_register','approved_by','auth.users','id')
    ) as v(table_name,column_name,referenced_table,referenced_column)
  loop
    execute format('alter table %s alter column %I drop not null',item.table_name,item.column_name);
    for constraint_row in
      select conname from pg_constraint
      where conrelid=item.table_name::regclass
        and contype='f'
        and confrelid=item.referenced_table::regclass
        and conkey @> array[(select attnum from pg_attribute where attrelid=item.table_name::regclass and attname=item.column_name)]::smallint[]
    loop
      execute format('alter table %s drop constraint %I',item.table_name,constraint_row.conname);
    end loop;
    execute format('alter table %s add constraint %I foreign key (%I) references %s(%I) on delete set null',
      item.table_name,
      replace(split_part(item.table_name,'.',2)||'_'||item.column_name||'_exit_fkey','-','_'),
      item.column_name,item.referenced_table,item.referenced_column);
  end loop;
end $$;
