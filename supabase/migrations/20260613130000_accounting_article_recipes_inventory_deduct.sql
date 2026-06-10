-- Artikel-Rezepte (Bestand) + Einstellung Bestandsabzug bei Rechnung

create table public.accounting_article_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  article_id uuid not null references public.accounting_articles (id) on delete cascade,
  ingredient_id text not null,
  amount numeric(14, 4) not null check (amount > 0),
  sort_order integer not null default 0,
  unique (article_id, ingredient_id),
  foreign key (restaurant_id, ingredient_id)
    references public.inventory_ingredients (restaurant_id, id)
    on delete restrict
);

create index accounting_article_recipe_lines_article_id_idx
  on public.accounting_article_recipe_lines (article_id);

create index accounting_article_recipe_lines_restaurant_id_idx
  on public.accounting_article_recipe_lines (restaurant_id);

alter table public.accounting_article_recipe_lines enable row level security;

create policy accounting_article_recipe_lines_staff_select
  on public.accounting_article_recipe_lines for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_article_recipe_lines_staff_write
  on public.accounting_article_recipe_lines for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'accounting.manage'));

alter table public.restaurant_accounting_settings
  add column if not exists deduct_inventory_on_invoice boolean not null default false;

alter table public.accounting_invoices
  add column if not exists inventory_deducted_at timestamptz;

comment on column public.restaurant_accounting_settings.deduct_inventory_on_invoice is
  'Bei Rechnungserstellung Bestand für Artikel mit Rezept abziehen.';

comment on column public.accounting_invoices.inventory_deducted_at is
  'Zeitpunkt der Bestandsbuchung aus Rechnungspositionen (Rezepte).';
