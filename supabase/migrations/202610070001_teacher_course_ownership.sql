-- Earlier installations used staff_accounts for created_by. ADD COLUMN IF NOT
-- EXISTS in the teacher migration leaves that old foreign key in place.
-- Preserve ownership and stop if any legacy owner needs an explicit mapping.
begin;

do $$
declare
  target_table regclass;
  owner_column smallint;
  foreign_key record;
  has_unmapped_owners boolean;
begin
  foreach target_table in array array['public.courses'::regclass, 'public.course_sections'::regclass]
  loop
    select attnum into strict owner_column from pg_attribute
    where attrelid = target_table and attname = 'created_by' and not attisdropped;

    execute format(
      'select exists (select 1 from %s c where c.created_by is not null and not exists (select 1 from public.teacher_accounts t where t.id = c.created_by))',
      target_table
    ) into has_unmapped_owners;
    if has_unmapped_owners then
      raise exception 'Unmapped legacy owners in %. Map their created_by IDs to teacher_accounts before applying this migration.', target_table;
    end if;

    for foreign_key in
      select conname from pg_constraint
      where conrelid = target_table and contype = 'f' and conkey = array[owner_column]::smallint[]
    loop
      execute format('alter table %s drop constraint %I', target_table, foreign_key.conname);
    end loop;

    execute format(
      'alter table %s add foreign key (created_by) references public.teacher_accounts(id)', target_table
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
