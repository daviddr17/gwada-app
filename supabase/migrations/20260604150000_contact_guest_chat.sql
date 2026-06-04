-- Gast-Zugang zum Gwada-Kontaktchat (Kontakt-UUID + 6-stellige PIN).

create extension if not exists pgcrypto with schema extensions;

alter table public.contacts
  add column if not exists guest_pin char(6),
  add column if not exists guest_pin_hash text;

comment on column public.contacts.guest_pin is
  '6-stellige PIN für Gast-Chat-Link (Klartext für Restaurant-Team).';
comment on column public.contacts.guest_pin_hash is
  'bcrypt-Hash der guest_pin für öffentliche Verifikation.';

do $$
declare
  r record;
  pin text;
  tries int;
begin
  for r in select id, restaurant_id from public.contacts where guest_pin is null
  loop
    tries := 0;
    loop
      tries := tries + 1;
      if tries > 80 then
        raise exception 'contact guest_pin backfill: keine freie PIN für restaurant %', r.restaurant_id;
      end if;
      pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
      exit when not exists (
        select 1 from public.contacts x
        where x.restaurant_id = r.restaurant_id and x.guest_pin = pin and x.id <> r.id
      );
    end loop;
    update public.contacts
    set
      guest_pin = pin,
      guest_pin_hash = extensions.crypt(pin, extensions.gen_salt('bf'))
    where id = r.id;
  end loop;
end;
$$;

alter table public.contacts
  alter column guest_pin set not null;

alter table public.contacts
  add constraint contacts_guest_pin_format check (guest_pin ~ '^[0-9]{6}$');

alter table public.contacts
  add constraint contacts_restaurant_guest_pin_uniq unique (restaurant_id, guest_pin);

create or replace function public.contacts_assign_guest_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pin text;
  tries int := 0;
begin
  if new.guest_pin is not null and new.guest_pin ~ '^[0-9]{6}$' then
    if new.guest_pin_hash is null or trim(new.guest_pin_hash) = '' then
      new.guest_pin_hash := extensions.crypt(new.guest_pin, extensions.gen_salt('bf'));
    end if;
    return new;
  end if;

  loop
    tries := tries + 1;
    if tries > 80 then
      raise exception 'Keine freie Gast-PIN für Restaurant %', new.restaurant_id;
    end if;
    pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.contacts x
      where x.restaurant_id = new.restaurant_id and x.guest_pin = pin
    );
  end loop;

  new.guest_pin := pin;
  new.guest_pin_hash := extensions.crypt(pin, extensions.gen_salt('bf'));
  return new;
end;
$$;

drop trigger if exists contacts_assign_guest_pin on public.contacts;

create trigger contacts_assign_guest_pin
  before insert on public.contacts
  for each row
  execute function public.contacts_assign_guest_pin();

create or replace function public.verify_contact_guest_pin(
  p_contact_id uuid,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hash text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return null;
  end if;
  select id, guest_pin_hash into v_id, v_hash
  from public.contacts
  where id = p_contact_id
  limit 1;
  if v_id is null or v_hash is null then
    return null;
  end if;
  if extensions.crypt(p_pin, v_hash) = v_hash then
    return v_id;
  end if;
  return null;
end;
$$;

comment on function public.verify_contact_guest_pin is
  'Prüft Kontakt-UUID + 6-stellige PIN; gibt contact.id zurück oder null.';

revoke all on function public.verify_contact_guest_pin(uuid, text) from public;
grant execute on function public.verify_contact_guest_pin(uuid, text) to anon;
grant execute on function public.verify_contact_guest_pin(uuid, text) to authenticated;

alter table public.restaurant_contact_settings
  add column if not exists guest_chat_url_template text;

comment on column public.restaurant_contact_settings.guest_chat_url_template is
  'URL-Vorlage für Gast-Chat: Platzhalter {id} oder {kontakt}, {pin}.';

alter table public.restaurant_contact_settings
  add constraint restaurant_contact_settings_guest_chat_url_len
    check (
      guest_chat_url_template is null
      or char_length(guest_chat_url_template) <= 2000
    );
