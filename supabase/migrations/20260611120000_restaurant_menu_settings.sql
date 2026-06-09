-- Speisekarten-Einstellungen pro Restaurant (Währung, später weitere Optionen).

create table public.restaurant_menu_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  currency_code char(3) not null default 'EUR'
    check (currency_code ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_menu_settings_set_updated_at
  before update on public.restaurant_menu_settings
  for each row execute function public.set_updated_at();

comment on table public.restaurant_menu_settings is
  'Speisekarten-Einstellungen (Währung, später weitere Felder).';
comment on column public.restaurant_menu_settings.currency_code is
  'ISO-4217-Währungscode für Preisanzeige und Google-Menü-Sync.';

alter table public.restaurant_menu_settings enable row level security;

create policy "restaurant_menu_settings_staff_all"
  on public.restaurant_menu_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));
