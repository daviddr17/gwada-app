-- Plattform-Listen: länderspezifische Zusatzstoffe / Allergene (Speisekarte marking_codes)

create table if not exists public.platform_food_marking_codes (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  code text not null,
  kind text not null,
  short_label text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_food_marking_codes_country_len check (
    char_length(country_code) = 2
  ),
  constraint platform_food_marking_codes_kind_check check (
    kind in ('additive', 'allergen')
  ),
  constraint platform_food_marking_codes_code_len check (
    char_length(trim(code)) between 1 and 32
  ),
  constraint platform_food_marking_codes_short_label_len check (
    char_length(trim(short_label)) between 1 and 32
  ),
  constraint platform_food_marking_codes_label_len check (
    char_length(trim(label)) between 1 and 200
  ),
  constraint platform_food_marking_codes_country_code_unique unique (
    country_code, code
  )
);

create index if not exists platform_food_marking_codes_country_idx
  on public.platform_food_marking_codes (country_code, sort_order, code);

create trigger platform_food_marking_codes_set_updated_at
  before update on public.platform_food_marking_codes
  for each row execute function public.set_updated_at();

alter table public.platform_food_marking_codes enable row level security;

create policy platform_food_marking_codes_superadmin_all
  on public.platform_food_marking_codes for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

create policy platform_food_marking_codes_authenticated_read
  on public.platform_food_marking_codes for select
  to authenticated
  using (is_active = true or public.auth_is_superadmin());

comment on table public.platform_food_marking_codes is
  'Zentrale Kennzeichnungslisten (Zusatzstoffe/Allergene) je Land — Speisekarte marking_codes.';

-- Seed aus food-marking-catalog.ts (DE/AT/CH/FR), nur wenn leer
insert into public.platform_food_marking_codes (
  country_code, code, kind, short_label, label, sort_order
)
select v.country_code, v.code, v.kind, v.short_label, v.label, v.sort_order
from (
  values
    ('DE', 'a', 'additive', 'a', 'mit Farbstoff', 0),
    ('DE', 'b', 'additive', 'b', 'mit Konservierungsstoff', 1),
    ('DE', 'c', 'additive', 'c', 'mit Antioxidationsmittel', 2),
    ('DE', 'd', 'additive', 'd', 'mit Geschmacksverstärker', 3),
    ('DE', 'e', 'additive', 'e', 'geschwefelt', 4),
    ('DE', 'f', 'additive', 'f', 'geschwärzt', 5),
    ('DE', 'g', 'additive', 'g', 'gewachst', 6),
    ('DE', 'h', 'additive', 'h', 'mit Phosphat', 7),
    ('DE', 'i', 'additive', 'i', 'mit Süßungsmittel', 8),
    ('DE', 'j', 'additive', 'j', 'enthält eine Phenylalaninquelle', 9),
    ('DE', 'k', 'additive', 'k', 'kann bei übermäßigem Verzehr abführend wirken', 10),
    ('DE', '1', 'allergen', '1', 'Glutenhaltiges Getreide', 11),
    ('DE', '2', 'allergen', '2', 'Krebstiere', 12),
    ('DE', '3', 'allergen', '3', 'Eier', 13),
    ('DE', '4', 'allergen', '4', 'Fische', 14),
    ('DE', '5', 'allergen', '5', 'Erdnüsse', 15),
    ('DE', '6', 'allergen', '6', 'Sojabohnen', 16),
    ('DE', '7', 'allergen', '7', 'Milch (inkl. Laktose)', 17),
    ('DE', '8', 'allergen', '8', 'Schalenfrüchte', 18),
    ('DE', '9', 'allergen', '9', 'Sellerie', 19),
    ('DE', '10', 'allergen', '10', 'Senf', 20),
    ('DE', '11', 'allergen', '11', 'Sesamsamen', 21),
    ('DE', '12', 'allergen', '12', 'Schwefeldioxid und Sulfite', 22),
    ('DE', '13', 'allergen', '13', 'Lupinen', 23),
    ('DE', '14', 'allergen', '14', 'Weichtiere', 24),
    ('AT', 'a', 'additive', 'a', 'mit Farbstoff', 0),
    ('AT', 'b', 'additive', 'b', 'mit Konservierungsstoff', 1),
    ('AT', 'c', 'additive', 'c', 'mit Antioxidationsmittel', 2),
    ('AT', 'd', 'additive', 'd', 'mit Geschmacksverstärker', 3),
    ('AT', 'e', 'additive', 'e', 'geschwefelt', 4),
    ('AT', 'f', 'additive', 'f', 'geschwärzt', 5),
    ('AT', 'g', 'additive', 'g', 'gewachst', 6),
    ('AT', 'h', 'additive', 'h', 'mit Phosphat', 7),
    ('AT', 'i', 'additive', 'i', 'mit Süßungsmittel', 8),
    ('AT', 'j', 'additive', 'j', 'enthält eine Phenylalaninquelle', 9),
    ('AT', 'k', 'additive', 'k', 'kann bei übermäßigem Verzehr abführend wirken', 10),
    ('AT', '1', 'allergen', '1', 'Glutenhaltiges Getreide', 11),
    ('AT', '2', 'allergen', '2', 'Krebstiere', 12),
    ('AT', '3', 'allergen', '3', 'Eier', 13),
    ('AT', '4', 'allergen', '4', 'Fische', 14),
    ('AT', '5', 'allergen', '5', 'Erdnüsse', 15),
    ('AT', '6', 'allergen', '6', 'Sojabohnen', 16),
    ('AT', '7', 'allergen', '7', 'Milch (inkl. Laktose)', 17),
    ('AT', '8', 'allergen', '8', 'Schalenfrüchte', 18),
    ('AT', '9', 'allergen', '9', 'Sellerie', 19),
    ('AT', '10', 'allergen', '10', 'Senf', 20),
    ('AT', '11', 'allergen', '11', 'Sesamsamen', 21),
    ('AT', '12', 'allergen', '12', 'Schwefeldioxid und Sulfite', 22),
    ('AT', '13', 'allergen', '13', 'Lupinen', 23),
    ('AT', '14', 'allergen', '14', 'Weichtiere', 24),
    ('CH', 'a', 'additive', 'a', 'mit Farbstoff', 0),
    ('CH', 'b', 'additive', 'b', 'mit Konservierungsstoff', 1),
    ('CH', 'c', 'additive', 'c', 'mit Antioxidationsmittel', 2),
    ('CH', 'd', 'additive', 'd', 'mit Geschmacksverstärker', 3),
    ('CH', 'e', 'additive', 'e', 'geschwefelt', 4),
    ('CH', 'f', 'additive', 'f', 'mit Phosphat', 5),
    ('CH', 'g', 'additive', 'g', 'mit Süssstoff', 6),
    ('CH', 'h', 'additive', 'h', 'enthält eine Phenylalaninquelle', 7),
    ('CH', '1', 'allergen', '1', 'Glutenhaltiges Getreide', 8),
    ('CH', '2', 'allergen', '2', 'Krebstiere', 9),
    ('CH', '3', 'allergen', '3', 'Eier', 10),
    ('CH', '4', 'allergen', '4', 'Fische', 11),
    ('CH', '5', 'allergen', '5', 'Erdnüsse', 12),
    ('CH', '6', 'allergen', '6', 'Sojabohnen', 13),
    ('CH', '7', 'allergen', '7', 'Milch (inkl. Laktose)', 14),
    ('CH', '8', 'allergen', '8', 'Schalenfrüchte', 15),
    ('CH', '9', 'allergen', '9', 'Sellerie', 16),
    ('CH', '10', 'allergen', '10', 'Senf', 17),
    ('CH', '11', 'allergen', '11', 'Sesamsamen', 18),
    ('CH', '12', 'allergen', '12', 'Schwefeldioxid und Sulfite', 19),
    ('CH', '13', 'allergen', '13', 'Lupinen', 20),
    ('CH', '14', 'allergen', '14', 'Weichtiere', 21),
    ('FR', 'a', 'additive', 'a', 'avec colorant', 0),
    ('FR', 'b', 'additive', 'b', 'avec conservateur', 1),
    ('FR', 'c', 'additive', 'c', 'avec antioxydant', 2),
    ('FR', 'd', 'additive', 'd', 'avec exhausteur de goût', 3),
    ('FR', 'e', 'additive', 'e', 'sulfité', 4),
    ('FR', 'f', 'additive', 'f', 'avec phosphate', 5),
    ('FR', 'g', 'additive', 'g', 'avec édulcorant', 6),
    ('FR', 'h', 'additive', 'h', 'contient une source de phénylalanine', 7),
    ('FR', '1', 'allergen', '1', 'Céréales contenant du gluten', 8),
    ('FR', '2', 'allergen', '2', 'Crustacés', 9),
    ('FR', '3', 'allergen', '3', 'Œufs', 10),
    ('FR', '4', 'allergen', '4', 'Poissons', 11),
    ('FR', '5', 'allergen', '5', 'Arachides', 12),
    ('FR', '6', 'allergen', '6', 'Soja', 13),
    ('FR', '7', 'allergen', '7', 'Lait (y compris lactose)', 14),
    ('FR', '8', 'allergen', '8', 'Fruits à coque', 15),
    ('FR', '9', 'allergen', '9', 'Céleri', 16),
    ('FR', '10', 'allergen', '10', 'Moutarde', 17),
    ('FR', '11', 'allergen', '11', 'Graines de sésame', 18),
    ('FR', '12', 'allergen', '12', 'Anhydride sulfureux et sulfites', 19),
    ('FR', '13', 'allergen', '13', 'Lupin', 20),
    ('FR', '14', 'allergen', '14', 'Mollusques', 21)
) as v(country_code, code, kind, short_label, label, sort_order)
where not exists (select 1 from public.platform_food_marking_codes limit 1);
