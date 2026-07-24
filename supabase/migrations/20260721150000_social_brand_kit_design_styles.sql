-- Social-Marke: Design-Stile erweitern (schlicht / modern / warm / fancy / fein)

alter table public.restaurant_social_brand_kit
  drop constraint if exists restaurant_social_brand_kit_style_preset_check;

-- Legacy-Werte migrieren
update public.restaurant_social_brand_kit
set style_preset = case style_preset
  when 'modern_plain' then 'schlicht'
  when 'warm_gastro' then 'warm'
  when 'dark_fine' then 'fein'
  else style_preset
end
where style_preset in ('modern_plain', 'warm_gastro', 'dark_fine');

alter table public.restaurant_social_brand_kit
  alter column style_preset set default 'schlicht';

alter table public.restaurant_social_brand_kit
  add constraint restaurant_social_brand_kit_style_preset_check
  check (style_preset in ('schlicht', 'modern', 'warm', 'fancy', 'fein'));
