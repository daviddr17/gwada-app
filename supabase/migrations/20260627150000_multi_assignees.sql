-- Mehrfach-Zuweisung: Mitarbeiter und Positionen für ToDos und Eigenkontrolle-Vorlagen

create table public.restaurant_staff_todo_staff_assignees (
  todo_id uuid not null references public.restaurant_staff_todos (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (todo_id, staff_id)
);

create index restaurant_staff_todo_staff_assignees_staff_idx
  on public.restaurant_staff_todo_staff_assignees (staff_id);

create table public.restaurant_staff_todo_position_assignees (
  todo_id uuid not null references public.restaurant_staff_todos (id) on delete cascade,
  position_tag_id uuid not null references public.restaurant_staff_position_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (todo_id, position_tag_id)
);

create index restaurant_staff_todo_position_assignees_tag_idx
  on public.restaurant_staff_todo_position_assignees (position_tag_id);

create table public.restaurant_compliance_checklist_staff_assignees (
  checklist_id uuid not null references public.restaurant_compliance_checklists (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checklist_id, staff_id)
);

create index restaurant_compliance_checklist_staff_assignees_staff_idx
  on public.restaurant_compliance_checklist_staff_assignees (staff_id);

create table public.restaurant_compliance_checklist_position_assignees (
  checklist_id uuid not null references public.restaurant_compliance_checklists (id) on delete cascade,
  position_tag_id uuid not null references public.restaurant_staff_position_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checklist_id, position_tag_id)
);

create index restaurant_compliance_checklist_position_assignees_tag_idx
  on public.restaurant_compliance_checklist_position_assignees (position_tag_id);

-- Bestehende Einzelzuweisungen übernehmen
insert into public.restaurant_staff_todo_staff_assignees (todo_id, staff_id)
select id, staff_id
from public.restaurant_staff_todos
where staff_id is not null
on conflict do nothing;

insert into public.restaurant_staff_todo_position_assignees (todo_id, position_tag_id)
select id, position_tag_id
from public.restaurant_staff_todos
where position_tag_id is not null
on conflict do nothing;

insert into public.restaurant_compliance_checklist_staff_assignees (checklist_id, staff_id)
select id, staff_id
from public.restaurant_compliance_checklists
where staff_id is not null
on conflict do nothing;

insert into public.restaurant_compliance_checklist_position_assignees (checklist_id, position_tag_id)
select id, position_tag_id
from public.restaurant_compliance_checklists
where position_tag_id is not null
on conflict do nothing;

-- Legacy-Spalten optional halten; Zuweisungs-Constraint lockert
alter table public.restaurant_staff_todos
  alter column assignee_type drop not null;

alter table public.restaurant_staff_todos
  drop constraint if exists restaurant_staff_todos_assignee_fk_check;

alter table public.restaurant_staff_todos
  drop constraint if exists restaurant_staff_todos_assignee_type_check;

alter table public.restaurant_staff_todos
  add constraint restaurant_staff_todos_assignee_type_check check (
    assignee_type is null
    or assignee_type in ('staff', 'position_tag', 'mixed')
  );

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_assignee_fk_check;

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_assignee_type_check;

alter table public.restaurant_compliance_checklists
  add constraint restaurant_compliance_checklists_assignee_type_check check (
    assignee_type is null
    or assignee_type in ('staff', 'position_tag', 'mixed')
  );

-- RLS
alter table public.restaurant_staff_todo_staff_assignees enable row level security;
alter table public.restaurant_staff_todo_position_assignees enable row level security;
alter table public.restaurant_compliance_checklist_staff_assignees enable row level security;
alter table public.restaurant_compliance_checklist_position_assignees enable row level security;

create policy restaurant_staff_todo_staff_assignees_rw
  on public.restaurant_staff_todo_staff_assignees for all to authenticated
  using (
    exists (
      select 1 from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.read')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.update')
    )
  );

create policy restaurant_staff_todo_position_assignees_rw
  on public.restaurant_staff_todo_position_assignees for all to authenticated
  using (
    exists (
      select 1 from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.read')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_staff_todos t
      where t.id = todo_id
        and public.auth_has_restaurant_permission(t.restaurant_id, 'staff_todos.update')
    )
  );

create policy restaurant_compliance_checklist_staff_assignees_rw
  on public.restaurant_compliance_checklist_staff_assignees for all to authenticated
  using (
    exists (
      select 1 from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.read')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.update')
    )
  );

create policy restaurant_compliance_checklist_position_assignees_rw
  on public.restaurant_compliance_checklist_position_assignees for all to authenticated
  using (
    exists (
      select 1 from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.read')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.update')
    )
  );
