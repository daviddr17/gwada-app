-- Reparatur: Default-Zeile für Plattform-Branding (fehlte auf manchen Dev-DBs).

insert into public.platform_app_settings (id)
values ('default')
on conflict (id) do nothing;
