-- Events-Einbindung: widget 'events' in restaurant_embed_appearance erlauben.
alter table public.restaurant_embed_appearance
  drop constraint if exists restaurant_embed_appearance_widget_check;

alter table public.restaurant_embed_appearance
  add constraint restaurant_embed_appearance_widget_check check (
    widget in (
      'opening_hours',
      'menu',
      'reviews',
      'news',
      'events',
      'reservation',
      'gallery'
    )
  );
