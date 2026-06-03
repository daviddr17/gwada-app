-- Display: stabile Geräte-Installation pro Tablet (ersetzt ein einzelnes device_secret_hash langfristig).

create table if not exists public.restaurant_display_installations (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.restaurant_displays (id) on delete cascade,
  installation_id text not null,
  device_secret_hash text not null,
  user_agent text,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_display_installations_installation_id_len
    check (char_length(installation_id) between 8 and 128),
  unique (display_id, installation_id)
);

create index if not exists restaurant_display_installations_display_hash_idx
  on public.restaurant_display_installations (display_id, device_secret_hash);

comment on table public.restaurant_display_installations is
  'Pro Tablet eine Installation (client-seitige ID in localStorage), eigenes Token — kein MAC im Browser.';

comment on column public.restaurant_display_installations.installation_id is
  'Vom Tablet erzeugte, stabile ID (z. B. UUID in localStorage), nicht die Hardware-MAC.';

-- Bestehende Einzel-Kopplung übernehmen
insert into public.restaurant_display_installations (display_id, installation_id, device_secret_hash)
select id, '__legacy__', device_secret_hash
from public.restaurant_displays
where device_secret_hash is not null
on conflict (display_id, installation_id) do nothing;

alter table public.restaurant_display_installations enable row level security;

drop policy if exists restaurant_display_installations_staff on public.restaurant_display_installations;
create policy restaurant_display_installations_staff
  on public.restaurant_display_installations for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_displays d
      where d.id = restaurant_display_installations.display_id
        and public.auth_is_restaurant_staff(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_displays d
      where d.id = restaurant_display_installations.display_id
        and public.auth_is_restaurant_staff(d.restaurant_id)
    )
  );
