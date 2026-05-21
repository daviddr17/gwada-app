-- Referenz-Länder (Vorwahl, Flagge, später z. B. App-Sprache).
create table public.countries (
  iso2 char(2) primary key,
  name_de text not null,
  dial_code text not null,
  flag_emoji text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  constraint countries_dial_code_format check (dial_code ~ '^\+[0-9]{1,4}$')
);

comment on table public.countries is
  'Referenzliste für Telefon-Vorwahlen, UI-Flags und spätere Lokalisierung.';

alter table public.countries enable row level security;

create policy "countries_select_authenticated"
  on public.countries for select
  to authenticated
  using (active = true);

insert into public.countries (iso2, name_de, dial_code, flag_emoji, sort_order) values
  ('DE', 'Deutschland', '+49', '🇩🇪', 10),
  ('AT', 'Österreich', '+43', '🇦🇹', 20),
  ('CH', 'Schweiz', '+41', '🇨🇭', 30),
  ('FR', 'Frankreich', '+33', '🇫🇷', 40),
  ('BE', 'Belgien', '+32', '🇧🇪', 50),
  ('NL', 'Niederlande', '+31', '🇳🇱', 60),
  ('LU', 'Luxemburg', '+352', '🇱🇺', 70),
  ('IT', 'Italien', '+39', '🇮🇹', 80),
  ('ES', 'Spanien', '+34', '🇪🇸', 90),
  ('PT', 'Portugal', '+351', '🇵🇹', 100),
  ('PL', 'Polen', '+48', '🇵🇱', 110),
  ('CZ', 'Tschechien', '+420', '🇨🇿', 120),
  ('DK', 'Dänemark', '+45', '🇩🇰', 130),
  ('SE', 'Schweden', '+46', '🇸🇪', 140),
  ('NO', 'Norwegen', '+47', '🇳🇴', 150),
  ('GB', 'Vereinigtes Königreich', '+44', '🇬🇧', 160),
  ('IE', 'Irland', '+353', '🇮🇪', 170),
  ('GR', 'Griechenland', '+30', '🇬🇷', 180),
  ('HU', 'Ungarn', '+36', '🇭🇺', 190),
  ('RO', 'Rumänien', '+40', '🇷🇴', 200),
  ('GP', 'Guadeloupe', '+590', '🇬🇵', 900),
  ('MQ', 'Martinique', '+596', '🇲🇶', 910),
  ('US', 'USA', '+1', '🇺🇸', 920);
