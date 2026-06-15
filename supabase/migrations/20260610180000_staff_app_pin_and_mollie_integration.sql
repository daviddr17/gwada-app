-- Staff app PIN lock (profiles) + Mollie restaurant integration key

alter table public.profiles
  add column if not exists staff_app_pin_hash text,
  add column if not exists staff_app_pin_failed_attempts integer not null default 0,
  add column if not exists staff_app_pin_set_at timestamptz;

comment on column public.profiles.staff_app_pin_hash is
  'bcrypt hash of Gwada Staff app PIN (4–6 digits).';
comment on column public.profiles.staff_app_pin_failed_attempts is
  'Failed PIN attempts; reset on success. Sign out at 5.';
comment on column public.profiles.staff_app_pin_set_at is
  'When the staff app PIN was last set.';

-- Set own PIN (authenticated user)
create or replace function public.set_staff_app_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_pin text := trim(coalesce(p_pin, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if length(v_pin) < 4 or length(v_pin) > 6 or v_pin !~ '^\d+$' then
    raise exception 'invalid_pin_format';
  end if;

  update public.profiles
  set
    staff_app_pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
    staff_app_pin_failed_attempts = 0,
    staff_app_pin_set_at = timezone('utc', now())
  where id = v_uid;
end;
$$;

revoke all on function public.set_staff_app_pin(text) from public;
grant execute on function public.set_staff_app_pin(text) to authenticated;

-- Verify PIN; increments failures; raises on lockout
create or replace function public.verify_staff_app_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_pin text := trim(coalesce(p_pin, ''));
  v_hash text;
  v_failures integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select staff_app_pin_hash, staff_app_pin_failed_attempts
  into v_hash, v_failures
  from public.profiles
  where id = v_uid;

  if v_hash is null or trim(v_hash) = '' then
    return false;
  end if;

  if v_failures >= 5 then
    raise exception 'pin_locked';
  end if;

  if extensions.crypt(v_pin, v_hash) = v_hash then
    update public.profiles
    set staff_app_pin_failed_attempts = 0
    where id = v_uid;
    return true;
  end if;

  update public.profiles
  set staff_app_pin_failed_attempts = staff_app_pin_failed_attempts + 1
  where id = v_uid;

  return false;
end;
$$;

revoke all on function public.verify_staff_app_pin(text) from public;
grant execute on function public.verify_staff_app_pin(text) to authenticated;

create or replace function public.staff_app_pin_status()
returns table (
  pin_set boolean,
  failed_attempts integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (staff_app_pin_hash is not null and trim(staff_app_pin_hash) <> '') as pin_set,
    staff_app_pin_failed_attempts as failed_attempts
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function public.staff_app_pin_status() from public;
grant execute on function public.staff_app_pin_status() to authenticated;

-- Mollie integration key on restaurant_integrations
alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_key_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_key_check
  check (
    integration_key in (
      'whatsapp',
      'email',
      'facebook',
      'instagram',
      'google_business',
      'lexoffice',
      'mollie'
    )
  );

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_status_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_status_check
  check (
  (
    integration_key = 'whatsapp'
    and status in ('disconnected', 'pending', 'working', 'error')
  )
  or (
    integration_key = 'email'
    and status in ('disconnected', 'pending', 'working', 'error')
  )
  or (
    integration_key in ('facebook', 'instagram', 'google_business', 'lexoffice', 'mollie')
    and status in ('disconnected', 'pending', 'working', 'error')
  )
  );

-- Permission integrations.mollie (owner + manager)
insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.mollie'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

-- Extend platform_messaging_flags with mollie_enabled
drop function if exists public.platform_messaging_flags();

create or replace function public.platform_messaging_flags()
returns table (
  whatsapp_enabled boolean,
  email_enabled boolean,
  facebook_enabled boolean,
  instagram_enabled boolean,
  google_business_enabled boolean,
  lexoffice_enabled boolean,
  mollie_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'whatsapp'), false),
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'email'), false),
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'facebook'), false),
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'instagram'), false),
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'google_business'), false),
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'lexoffice'), false),
    coalesce((select p.enabled from public.platform_integrations p where p.key = 'mollie'), false);
$$;

revoke all on function public.platform_messaging_flags() from public;
grant execute on function public.platform_messaging_flags() to authenticated;
