-- Dashboard: Widget-Sichtbarkeit und -Reihenfolge pro Benutzer pro Restaurant.

create table public.user_restaurant_dashboard_widgets (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  widget_order text[] not null,
  widget_visibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id),
  constraint user_restaurant_dashboard_widgets_visibility_is_object
    check (jsonb_typeof(widget_visibility) = 'object')
);

create index user_restaurant_dashboard_widgets_restaurant_id_idx
  on public.user_restaurant_dashboard_widgets (restaurant_id);

create trigger user_restaurant_dashboard_widgets_set_updated_at
  before update on public.user_restaurant_dashboard_widgets
  for each row execute function public.set_updated_at();

alter table public.user_restaurant_dashboard_widgets enable row level security;

create policy "user_restaurant_dashboard_widgets_rw_own_staff"
  on public.user_restaurant_dashboard_widgets for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

comment on table public.user_restaurant_dashboard_widgets is
  'Dashboard-Widgets: Reihenfolge und Sichtbarkeit je authentifiziertem Profil je Restaurant.';
