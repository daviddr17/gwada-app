-- Eigenkontrolle: Zuweisung, Display-Trigger, Verschieben; ToDo-Erledigungsnotiz

alter table public.restaurant_compliance_checklists
  add column if not exists assignee_type text,
  add column if not exists staff_id uuid references public.restaurant_staff (id) on delete cascade,
  add column if not exists position_tag_id uuid references public.restaurant_staff_position_tags (id) on delete cascade,
  add column if not exists priority text not null default 'medium',
  add column if not exists display_from timestamptz,
  add column if not exists display_until timestamptz,
  add column if not exists show_before_clock_in boolean not null default false,
  add column if not exists show_before_break_start boolean not null default false,
  add column if not exists show_before_break_end boolean not null default false,
  add column if not exists show_before_clock_out boolean not null default false,
  add column if not exists show_on_pin_login boolean not null default false,
  add column if not exists require_defer_reason boolean not null default false,
  add column if not exists blocks_shift_end boolean not null default false;

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_assignee_type_check;

alter table public.restaurant_compliance_checklists
  add constraint restaurant_compliance_checklists_assignee_type_check check (
    assignee_type is null
    or assignee_type in ('staff', 'position_tag')
  );

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_priority_check;

alter table public.restaurant_compliance_checklists
  add constraint restaurant_compliance_checklists_priority_check check (
    priority in ('high', 'medium', 'low')
  );

alter table public.restaurant_compliance_checklists
  drop constraint if exists restaurant_compliance_checklists_assignee_fk_check;

alter table public.restaurant_compliance_checklists
  add constraint restaurant_compliance_checklists_assignee_fk_check check (
    (
      assignee_type is null
      and staff_id is null
      and position_tag_id is null
    )
    or (
      assignee_type = 'staff'
      and staff_id is not null
      and position_tag_id is null
    )
    or (
      assignee_type = 'position_tag'
      and position_tag_id is not null
      and staff_id is null
    )
  );

create index if not exists restaurant_compliance_checklists_staff_idx
  on public.restaurant_compliance_checklists (staff_id)
  where staff_id is not null;

create index if not exists restaurant_compliance_checklists_position_tag_idx
  on public.restaurant_compliance_checklists (position_tag_id)
  where position_tag_id is not null;

create table if not exists public.restaurant_compliance_deferrals (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.restaurant_compliance_checklists (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  trigger_type text not null,
  reason text,
  note text,
  deferred_at timestamptz not null default now(),
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  constraint restaurant_compliance_deferrals_trigger_check check (
    trigger_type in (
      'clock_in',
      'break_start',
      'break_end',
      'clock_out',
      'pin_login'
    )
  ),
  constraint restaurant_compliance_deferrals_reason_len check (
    reason is null or char_length(reason) <= 500
  ),
  constraint restaurant_compliance_deferrals_note_len check (
    note is null or char_length(note) <= 2000
  )
);

create index restaurant_compliance_deferrals_staff_active_idx
  on public.restaurant_compliance_deferrals (staff_id, checklist_id)
  where cleared_at is null;

alter table public.restaurant_compliance_deferrals enable row level security;

create policy restaurant_compliance_deferrals_select
  on public.restaurant_compliance_deferrals for select to authenticated
  using (
    exists (
      select 1
      from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.read')
    )
  );

create policy restaurant_compliance_deferrals_write
  on public.restaurant_compliance_deferrals for all to authenticated
  using (
    exists (
      select 1
      from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.update')
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_compliance_checklists c
      where c.id = checklist_id
        and public.auth_has_restaurant_permission(c.restaurant_id, 'compliance.update')
    )
  );

alter table public.restaurant_compliance_log_entries
  drop constraint if exists restaurant_compliance_log_action_check;

alter table public.restaurant_compliance_log_entries
  add constraint restaurant_compliance_log_action_check check (
    action in (
      'checklist_created',
      'checklist_updated',
      'checklist_archived',
      'device_created',
      'device_updated',
      'device_archived',
      'record_created',
      'record_updated',
      'deferred',
      'templates_seeded'
    )
  );

alter table public.restaurant_compliance_settings
  add column if not exists show_due_reminders boolean not null default true;

alter table public.restaurant_staff_todo_completions
  add column if not exists completion_note text;

alter table public.restaurant_staff_todo_completions
  drop constraint if exists restaurant_staff_todo_completions_note_len;

alter table public.restaurant_staff_todo_completions
  add constraint restaurant_staff_todo_completions_note_len check (
    completion_note is null or char_length(completion_note) <= 2000
  );
