-- Dashboard-FAB: Shortcut-Reihenfolge und Sichtbarkeit pro Benutzer/Restaurant.

alter table public.user_restaurant_dashboard_widgets
  add column if not exists shortcut_order text[] not null default '{}'::text[],
  add column if not exists shortcut_visibility jsonb not null default '{}'::jsonb;

alter table public.user_restaurant_dashboard_widgets
  drop constraint if exists user_restaurant_dashboard_widgets_shortcut_visibility_is_object;

alter table public.user_restaurant_dashboard_widgets
  add constraint user_restaurant_dashboard_widgets_shortcut_visibility_is_object
  check (jsonb_typeof(shortcut_visibility) = 'object');

comment on column public.user_restaurant_dashboard_widgets.shortcut_order is
  'Reihenfolge der FAB-Shortcuts (IDs); max. 5 sichtbare Einträge im Menü.';

comment on column public.user_restaurant_dashboard_widgets.shortcut_visibility is
  'Sichtbarkeit je Shortcut-ID (true/false).';
