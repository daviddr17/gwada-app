-- Kontakte pro Restaurant: mehrere E-Mails/Telefonnummern, Verknüpfung mit Reservierungen.

-- ---------------------------------------------------------------------------
-- Einstellungen
-- ---------------------------------------------------------------------------
create table public.restaurant_contact_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  auto_create_from_reservations boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_contact_settings_set_updated_at
  before update on public.restaurant_contact_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_contact_settings enable row level security;

create policy "restaurant_contact_settings_staff_all"
  on public.restaurant_contact_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Kontakte
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  company text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_interaction_at timestamptz
);

create index contacts_restaurant_id_idx on public.contacts (restaurant_id);
create index contacts_restaurant_last_interaction_idx
  on public.contacts (restaurant_id, last_interaction_at desc nulls last);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

create policy "contacts_staff_all"
  on public.contacts for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- E-Mails & Telefonnummern
-- ---------------------------------------------------------------------------
create table public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null,
  email_normalized text not null,
  label text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_emails_email_len check (char_length(email) <= 320)
);

create unique index contact_emails_restaurant_normalized_idx
  on public.contact_emails (restaurant_id, email_normalized);

create index contact_emails_contact_id_idx on public.contact_emails (contact_id);

alter table public.contact_emails enable row level security;

create policy "contact_emails_staff_all"
  on public.contact_emails for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create table public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_display text not null,
  phone_normalized text not null,
  country_iso2 char(2),
  label text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_phones_display_len check (char_length(phone_display) <= 64)
);

create unique index contact_phones_restaurant_normalized_idx
  on public.contact_phones (restaurant_id, phone_normalized);

create index contact_phones_contact_id_idx on public.contact_phones (contact_id);

alter table public.contact_phones enable row level security;

create policy "contact_phones_staff_all"
  on public.contact_phones for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Reservierungen → Kontakt
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists contact_id uuid references public.contacts (id) on delete set null;

create index reservations_contact_id_idx on public.reservations (contact_id)
  where contact_id is not null;

-- ---------------------------------------------------------------------------
-- Normalisierung (Matching)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_contact_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or btrim(p_email) = '' then null
    else lower(btrim(p_email))
  end;
$$;

create or replace function public.normalize_contact_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  raw text;
  digits text;
begin
  if p_phone is null or btrim(p_phone) = '' then
    return null;
  end if;
  raw := btrim(p_phone);
  if raw like '00%' then
    raw := '+' || substring(raw from 3);
  end if;
  if raw like '+%' then
    digits := regexp_replace(substring(raw from 2), '[^0-9]', '', 'g');
  else
    digits := regexp_replace(raw, '[^0-9]', '', 'g');
    if digits like '0%' then
      digits := regexp_replace(digits, '^0+', '');
    end if;
  end if;
  if digits is null or digits = '' then
    return null;
  end if;
  return digits;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verknüpfung Reservierung ↔ Kontakt (vor INSERT/UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.trg_reservations_link_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto boolean := true;
  v_email_norm text;
  v_phone_norm text;
  v_contact_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  select coalesce(s.auto_create_from_reservations, true)
  into v_auto
  from public.restaurant_contact_settings s
  where s.restaurant_id = new.restaurant_id;

  if not found then
    v_auto := true;
  end if;

  v_email_norm := public.normalize_contact_email(new.guest_email);
  v_phone_norm := public.normalize_contact_phone(new.guest_phone);

  if v_phone_norm is not null then
    select cp.contact_id
    into v_contact_id
    from public.contact_phones cp
    where cp.restaurant_id = new.restaurant_id
      and cp.phone_normalized = v_phone_norm
    limit 1;
  end if;

  if v_contact_id is null and v_email_norm is not null then
    select ce.contact_id
    into v_contact_id
    from public.contact_emails ce
    where ce.restaurant_id = new.restaurant_id
      and ce.email_normalized = v_email_norm
    limit 1;
  end if;

  if v_contact_id is not null then
    new.contact_id := v_contact_id;

    update public.contacts c
    set
      last_interaction_at = v_now,
      first_name = case
        when btrim(c.first_name) = '' and btrim(new.guest_first_name) <> ''
          then new.guest_first_name
        else c.first_name
      end,
      last_name = case
        when btrim(c.last_name) = '' and btrim(new.guest_last_name) <> ''
          then new.guest_last_name
        else c.last_name
      end,
      updated_at = v_now
    where c.id = v_contact_id;

    if v_email_norm is not null then
      insert into public.contact_emails (
        contact_id,
        restaurant_id,
        email,
        email_normalized,
        is_primary
      )
      values (
        v_contact_id,
        new.restaurant_id,
        btrim(new.guest_email),
        v_email_norm,
        not exists (
          select 1 from public.contact_emails e where e.contact_id = v_contact_id
        )
      )
      on conflict (restaurant_id, email_normalized) do nothing;
    end if;

    if v_phone_norm is not null then
      insert into public.contact_phones (
        contact_id,
        restaurant_id,
        phone_display,
        phone_normalized,
        is_primary
      )
      values (
        v_contact_id,
        new.restaurant_id,
        btrim(new.guest_phone),
        v_phone_norm,
        not exists (
          select 1 from public.contact_phones p where p.contact_id = v_contact_id
        )
      )
      on conflict (restaurant_id, phone_normalized) do nothing;
    end if;

    return new;
  end if;

  if not v_auto then
    new.contact_id := null;
    return new;
  end if;

  if v_phone_norm is null and v_email_norm is null then
    new.contact_id := null;
    return new;
  end if;

  insert into public.contacts (
    restaurant_id,
    first_name,
    last_name,
    last_interaction_at
  )
  values (
    new.restaurant_id,
    coalesce(nullif(btrim(new.guest_first_name), ''), 'Gast'),
    coalesce(btrim(new.guest_last_name), ''),
    v_now
  )
  returning id into v_contact_id;

  if v_email_norm is not null then
    insert into public.contact_emails (
      contact_id,
      restaurant_id,
      email,
      email_normalized,
      is_primary
    )
    values (
      v_contact_id,
      new.restaurant_id,
      btrim(new.guest_email),
      v_email_norm,
      true
    );
  end if;

  if v_phone_norm is not null then
    insert into public.contact_phones (
      contact_id,
      restaurant_id,
      phone_display,
      phone_normalized,
      is_primary
    )
    values (
      v_contact_id,
      new.restaurant_id,
      btrim(new.guest_phone),
      v_phone_norm,
      true
    );
  end if;

  new.contact_id := v_contact_id;
  return new;
end;
$$;

drop trigger if exists reservations_link_contact_before_ins on public.reservations;
create trigger reservations_link_contact_before_ins
  before insert on public.reservations
  for each row execute function public.trg_reservations_link_contact();

drop trigger if exists reservations_link_contact_before_upd on public.reservations;
create trigger reservations_link_contact_before_upd
  before update of guest_phone, guest_email, guest_first_name, guest_last_name
  on public.reservations
  for each row execute function public.trg_reservations_link_contact();

-- Bestehende Reservierungen einmalig verknüpfen (nur Zeilen ohne contact_id)
do $$
declare
  r record;
begin
  for r in
    select id
    from public.reservations
    where contact_id is null
      and (
        guest_phone is not null and btrim(guest_phone) <> ''
        or guest_email is not null and btrim(guest_email) <> ''
      )
    order by created_at asc
  loop
    update public.reservations res
    set guest_phone = res.guest_phone
    where res.id = r.id;
  end loop;
end;
$$;
