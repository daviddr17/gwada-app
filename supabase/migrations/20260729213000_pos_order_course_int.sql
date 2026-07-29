-- pos_order_lines.course: enum → integer (1=Vorspeise, 2=Hauptgang, 3=Dessert, …)
-- Map: starter→1, main→2, dessert→3, side|drink|other→2

alter table public.pos_order_lines
  add column if not exists course_int integer;

update public.pos_order_lines
set course_int = case course::text
  when 'starter' then 1
  when 'main' then 2
  when 'dessert' then 3
  else 2
end
where course_int is null;

alter table public.pos_order_lines
  alter column course_int set default 2;

alter table public.pos_order_lines
  alter column course_int set not null;

alter table public.pos_order_lines
  drop constraint if exists pos_order_lines_course_int_chk;

alter table public.pos_order_lines
  add constraint pos_order_lines_course_int_chk check (course_int >= 1);

alter table public.pos_order_lines
  drop column if exists course;

alter table public.pos_order_lines
  rename column course_int to course;

comment on column public.pos_order_lines.course is
  'Gang-Nummer >= 1 (UI typisch 1=Vorspeise, 2=Hauptgang, 3=Dessert)';

-- pos_kds_devices.courses: enum[] → integer[]
alter table public.pos_kds_devices
  add column if not exists courses_int integer[] not null default '{}';

update public.pos_kds_devices d
set courses_int = coalesce(
  (
    select array_agg(
      case x::text
        when 'starter' then 1
        when 'main' then 2
        when 'dessert' then 3
        else 2
      end
      order by ordinality
    )
    from unnest(d.courses) with ordinality as u(x, ordinality)
  ),
  '{}'
)
where d.courses is not null
  and cardinality(d.courses) > 0
  and cardinality(d.courses_int) = 0;

-- Geräte empty filters (already default '{}'); non-empty remapped above.
-- For rows that already had filters, force remap even if courses_int was defaulted empty:
update public.pos_kds_devices d
set courses_int = coalesce(
  (
    select array_agg(
      case x::text
        when 'starter' then 1
        when 'main' then 2
        when 'dessert' then 3
        else 2
      end
      order by ordinality
    )
    from unnest(d.courses) with ordinality as u(x, ordinality)
  ),
  '{}'
)
where cardinality(coalesce(d.courses, '{}')) > 0;

alter table public.pos_kds_devices
  drop column if exists courses;

alter table public.pos_kds_devices
  rename column courses_int to courses;

comment on column public.pos_kds_devices.courses is
  'Gang-Filter als Integer[]; leer = alle Gänge';

drop type if exists public.pos_order_course;
