-- Schichtplan: Vorlagen, geplante Schichten, Restaurant-Einstellungen.

create type public.staff_scheduled_shift_status as enum (
  'confirmed',
  'pending',
  'declined'
);

-- ---------------------------------------------------------------------------
-- Einstellungen pro Restaurant
-- ---------------------------------------------------------------------------
create table public.restaurant_shift_schedule_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  requires_acceptance boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_shift_schedule_settings_set_updated_at
  before update on public.restaurant_shift_schedule_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_shift_schedule_settings enable row level security;

create policy restaurant_shift_schedule_settings_staff_all
  on public.restaurant_shift_schedule_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_shift_schedule_settings is
  'Schichtplan-Einstellungen; requires_acceptance = Mitarbeiter müssen Schichten bestätigen.';

-- ---------------------------------------------------------------------------
-- Schicht-Vorlagen (Drag-Palette)
-- ---------------------------------------------------------------------------
create table public.restaurant_shift_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  color text not null default '#3b82f6',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_shift_templates_name_len check (char_length(name) between 1 and 80),
  constraint restaurant_shift_templates_color_len check (char_length(color) between 4 and 32)
);

create index restaurant_shift_templates_restaurant_sort_idx
  on public.restaurant_shift_templates (restaurant_id, sort_order, name);

create trigger restaurant_shift_templates_set_updated_at
  before update on public.restaurant_shift_templates
  for each row execute function public.set_updated_at();

alter table public.restaurant_shift_templates enable row level security;

create policy restaurant_shift_templates_staff_all
  on public.restaurant_shift_templates for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Geplante Schichten
-- ---------------------------------------------------------------------------
create table public.restaurant_staff_scheduled_shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  template_id uuid references public.restaurant_shift_templates (id) on delete set null,
  position_tag_id uuid references public.restaurant_staff_position_tags (id) on delete set null,
  label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.staff_scheduled_shift_status not null default 'confirmed',
  note text,
  series_id uuid,
  responded_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_scheduled_shifts_time_order check (ends_at > starts_at),
  constraint restaurant_staff_scheduled_shifts_label_len check (
    label is null or char_length(label) <= 120
  ),
  constraint restaurant_staff_scheduled_shifts_note_len check (
    note is null or char_length(note) <= 2000
  )
);

create index restaurant_staff_scheduled_shifts_restaurant_range_idx
  on public.restaurant_staff_scheduled_shifts (restaurant_id, starts_at, ends_at);

create index restaurant_staff_scheduled_shifts_staff_range_idx
  on public.restaurant_staff_scheduled_shifts (staff_id, starts_at);

create index restaurant_staff_scheduled_shifts_series_idx
  on public.restaurant_staff_scheduled_shifts (series_id)
  where series_id is not null;

create trigger restaurant_staff_scheduled_shifts_set_updated_at
  before update on public.restaurant_staff_scheduled_shifts
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_scheduled_shifts enable row level security;

create policy restaurant_staff_scheduled_shifts_staff_all
  on public.restaurant_staff_scheduled_shifts for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_scheduled_shifts is
  'Geplante Schichten (Schichtplan); getrennt von Arbeitszeiten/Zeiterfassung.';

-- Standard-Vorlagen für bestehende Restaurants
insert into public.restaurant_shift_templates (restaurant_id, name, start_time, end_time, color, sort_order)
select
  r.id,
  v.name,
  v.start_time::time,
  v.end_time::time,
  v.color,
  v.sort_order
from public.restaurants r
cross join (
  values
    ('Frühschicht', '06:00', '14:00', '#22c55e', 0),
    ('Mittelschicht', '10:00', '18:00', '#a855f7', 1),
    ('Spätschicht', '14:00', '22:00', '#3b82f6', 2)
) as v(name, start_time, end_time, color, sort_order)
where not exists (
  select 1
  from public.restaurant_shift_templates t
  where t.restaurant_id = r.id
);
