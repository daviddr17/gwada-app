-- Tischplan: Farbe pro Tisch + Breite/Höhe auf dem Plan (Anteil der Canvas-Kante 0–100 %).

alter table public.dining_tables
  add column if not exists color_hex text not null default '#94a3b8';

alter table public.dining_tables
  add column if not exists plan_w_pct numeric(7, 4) not null default 13
    check (plan_w_pct >= 4 and plan_w_pct <= 70),
  add column if not exists plan_h_pct numeric(7, 4) not null default 20
    check (plan_h_pct >= 4 and plan_h_pct <= 70);

alter table public.dining_tables
  drop constraint if exists dining_tables_color_hex_format_chk;

alter table public.dining_tables
  add constraint dining_tables_color_hex_format_chk
  check (color_hex ~ '^#[0-9a-fA-F]{6}$');

comment on column public.dining_tables.color_hex is
  'Anzeigefarbe des Tisches auf dem Tischplan (#rrggbb).';
comment on column public.dining_tables.plan_w_pct is
  'Breite des Tisch-Kastens relativ zur Canvas-Breite (4–70 %).';
comment on column public.dining_tables.plan_h_pct is
  'Höhe des Tisch-Kastens relativ zur Canvas-Höhe (4–70 %).';
