-- POS Ops: Indizes für Bestellhistorie, Artikel-Auswertung, Abschlüsse

create index if not exists pos_orders_restaurant_closed_at_idx
  on public.pos_orders (restaurant_id, closed_at desc nulls last);

create index if not exists pos_orders_restaurant_created_at_idx
  on public.pos_orders (restaurant_id, created_at desc);

create index if not exists pos_orders_restaurant_status_created_idx
  on public.pos_orders (restaurant_id, status, created_at desc);

create index if not exists pos_order_lines_menu_item_idx
  on public.pos_order_lines (menu_item_id)
  where menu_item_id is not null;

create index if not exists pos_order_lines_order_menu_item_idx
  on public.pos_order_lines (order_id, menu_item_id);

comment on index public.pos_orders_restaurant_closed_at_idx is
  'Dashboard Bestellhistorie / Artikel-Auswertung nach closed_at.';
