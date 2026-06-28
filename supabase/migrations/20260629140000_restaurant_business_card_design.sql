-- Visitenkarten-Layout pro Restaurant (Elemente, Farben, Dekorbild-Referenzen via documentId).

alter table public.restaurants
  add column if not exists business_card_design jsonb;

alter table public.restaurants
  drop constraint if exists restaurants_business_card_design_is_object;

alter table public.restaurants
  add constraint restaurants_business_card_design_is_object
  check (
    business_card_design is null
    or jsonb_typeof(business_card_design) = 'object'
  );

comment on column public.restaurants.business_card_design is
  'Visitenkarten-Layout: Format, Elemente, Farben; Dekorbilder referenzieren restaurant_documents.id.';
