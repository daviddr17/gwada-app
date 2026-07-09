-- CRM Phase B: auto-link master toggle, review auto-create, ambiguous identity detection on reservations.

alter table public.restaurant_contact_settings
  add column if not exists auto_link_enabled boolean not null default true,
  add column if not exists auto_create_from_reviews boolean not null default true;

comment on column public.restaurant_contact_settings.auto_link_enabled is
  'Automatische Kontakt-Verknüpfung und -Anlage (Modul-Toggles greifen nur wenn aktiv).';
comment on column public.restaurant_contact_settings.auto_create_from_reviews is
  'Bei Bewertungs-Einladungen Kontakt anlegen, wenn keiner passt.';

create or replace function public.trg_reservations_link_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto boolean := true;
  v_auto_link boolean := true;
  v_email_norm text;
  v_phone_norm text;
  v_phone_contact_id uuid;
  v_email_contact_id uuid;
  v_contact_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  select
    coalesce(s.auto_create_from_reservations, true),
    coalesce(s.auto_link_enabled, true)
  into v_auto, v_auto_link
  from public.restaurant_contact_settings s
  where s.restaurant_id = new.restaurant_id;

  if not found then
    v_auto := true;
    v_auto_link := true;
  end if;

  if not v_auto_link then
    return new;
  end if;

  v_email_norm := public.normalize_contact_email(new.guest_email);
  v_phone_norm := public.normalize_contact_phone(new.guest_phone);

  if v_phone_norm is not null then
    select cp.contact_id
    into v_phone_contact_id
    from public.contact_phones cp
    where cp.restaurant_id = new.restaurant_id
      and cp.phone_normalized = v_phone_norm
    limit 1;
  end if;

  if v_email_norm is not null then
    select ce.contact_id
    into v_email_contact_id
    from public.contact_emails ce
    where ce.restaurant_id = new.restaurant_id
      and ce.email_normalized = v_email_norm
    limit 1;
  end if;

  if v_phone_contact_id is not null
    and v_email_contact_id is not null
    and v_phone_contact_id <> v_email_contact_id then
    raise warning 'contact_identity_ambiguous reservation restaurant=% phone_contact=% email_contact=%',
      new.restaurant_id, v_phone_contact_id, v_email_contact_id;
    new.contact_id := null;
    return new;
  end if;

  v_contact_id := coalesce(v_phone_contact_id, v_email_contact_id);

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
