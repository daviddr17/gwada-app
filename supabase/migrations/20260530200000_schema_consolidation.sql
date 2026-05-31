-- Schema-Konsolidierung: parallele Speicher / Sync-Muster bereinigen
-- (analog zu time_sessions → work_entries)

-- ---------------------------------------------------------------------------
-- 1. Rollen-Position: restaurant_employees.position_id ist SSoT (App-Zugang);
--    restaurant_staff.restaurant_position_id nur Fallback vor Einladung / ohne Login.
--    Bidirektionale Sync-Trigger halten beide konsistent, wenn verknüpft.
-- ---------------------------------------------------------------------------

update public.restaurant_staff rs
set restaurant_position_id = re.position_id
from public.restaurant_employees re
where re.id = rs.employee_id
  and re.position_id is not null
  and rs.restaurant_position_id is distinct from re.position_id;

create or replace function public.trg_sync_staff_position_to_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if new.employee_id is null then
    return new;
  end if;
  if new.restaurant_position_id is not distinct from old.restaurant_position_id then
    return new;
  end if;

  select rp.slug into v_slug
  from public.restaurant_positions rp
  where rp.id = new.restaurant_position_id;

  update public.restaurant_employees re
  set
    position_id = new.restaurant_position_id,
    role = case
      when v_slug in ('owner', 'manager', 'host', 'server', 'kitchen', 'other')
        then v_slug::public.employee_role
      else 'other'::public.employee_role
    end
  where re.id = new.employee_id;

  return new;
end;
$$;

create or replace function public.trg_sync_employee_position_to_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.staff_id is null then
    return new;
  end if;
  if new.position_id is not distinct from old.position_id then
    return new;
  end if;

  update public.restaurant_staff rs
  set restaurant_position_id = new.position_id
  where rs.id = new.staff_id
    and rs.restaurant_position_id is distinct from new.position_id;

  return new;
end;
$$;

drop trigger if exists restaurant_staff_sync_position_to_employee on public.restaurant_staff;
create trigger restaurant_staff_sync_position_to_employee
  after update of restaurant_position_id, employee_id
  on public.restaurant_staff
  for each row
  execute function public.trg_sync_staff_position_to_employee();

drop trigger if exists restaurant_employees_sync_position_to_staff on public.restaurant_employees;
create trigger restaurant_employees_sync_position_to_staff
  after update of position_id, staff_id
  on public.restaurant_employees
  for each row
  execute function public.trg_sync_employee_position_to_staff();

-- Einladung: Position auch am Staff-Datensatz setzen (nicht nur restaurant_employees)
create or replace function public.accept_staff_invite(
  p_token text,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_invite record;
  v_staff record;
  v_emp_id uuid;
  v_token_hash text;
begin
  v_uid := coalesce(p_profile_id, (select auth.uid()));
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  select i.*, s.given_name, s.family_name, s.email as staff_email
  into v_invite
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  where i.token_hash = v_token_hash
    and i.status = 'pending'
    and i.expires_at > timezone('utc', now())
  for update of i;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  select * into v_staff from public.restaurant_staff where id = v_invite.staff_id;

  select id into v_emp_id
  from public.restaurant_employees
  where restaurant_id = v_invite.restaurant_id
    and profile_id = v_uid
  limit 1;

  if v_emp_id is not null then
    update public.restaurant_employees
    set
      staff_id = v_invite.staff_id,
      position_id = v_invite.restaurant_position_id,
      is_active = true
    where id = v_emp_id;
  else
    insert into public.restaurant_employees (
      restaurant_id,
      profile_id,
      staff_id,
      position_id,
      role,
      is_active
    )
    select
      v_invite.restaurant_id,
      v_uid,
      v_invite.staff_id,
      v_invite.restaurant_position_id,
      case
        when rp.slug in (
          'owner', 'manager', 'host', 'server', 'kitchen', 'other'
        ) then rp.slug::public.employee_role
        else 'other'::public.employee_role
      end,
      true
    from public.restaurant_positions rp
    where rp.id = v_invite.restaurant_position_id
    returning id into v_emp_id;
  end if;

  update public.restaurant_staff
  set
    profile_id = v_uid,
    employee_id = v_emp_id,
    restaurant_position_id = v_invite.restaurant_position_id
  where id = v_invite.staff_id;

  update public.restaurant_staff_invites
  set
    status = 'accepted',
    accepted_at = timezone('utc', now()),
    accepted_by = v_uid
  where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'restaurant_id', v_invite.restaurant_id,
    'staff_id', v_invite.staff_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- Display-Berechtigungen: eine Auflösungskette (Employee-Rolle, sonst Staff-Fallback)
create or replace function public.staff_display_permission_keys(p_staff_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with resolved as (
    select
      rs.id as staff_id,
      coalesce(re.position_id, rs.restaurant_position_id) as position_id
    from public.restaurant_staff rs
    left join public.restaurant_employees re on re.id = rs.employee_id
    where rs.id = p_staff_id
      and rs.is_active
  )
  select distinct rpp.permission_key
  from resolved r
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = r.position_id
  where r.position_id is not null
  union
  select unnest(array[
    'display.time',
    'display.reservations',
    'display.recipes',
    'display.kds',
    'display.module_switch'
  ]::text[])
  from resolved r
  inner join public.restaurant_positions rp on rp.id = r.position_id
  where rp.slug = 'owner';
$$;

comment on column public.restaurant_staff.restaurant_position_id is
  'Display-/Einladungs-Rolle vor App-Zugang. Mit employee_id: SSoT ist restaurant_employees.position_id (Sync per Trigger).';

-- ---------------------------------------------------------------------------
-- 2. Dokumente: ungenutzte staff_id-Spalte (nie angebunden; employee_id = Uploader)
-- ---------------------------------------------------------------------------

drop index if exists public.restaurant_documents_staff_idx;
alter table public.restaurant_documents drop column if exists staff_id;

-- ---------------------------------------------------------------------------
-- 3. Orders-Scaffold (kein App-Code) entfernen
-- ---------------------------------------------------------------------------

drop table if exists public.order_items;
drop table if exists public.orders;

-- ---------------------------------------------------------------------------
-- 4. restaurant_app_state: nur noch Legacy-Cache (kein zweites Schema)
-- ---------------------------------------------------------------------------

comment on table public.restaurant_app_state is
  'Legacy JSON-Cache für Migration zu relationalen Tabellen (restaurants, opening_hours, menu_*, inventory_*, user_restaurant_dashboard_widgets). Keine zweite Wahrheit — bei UUID-Restaurants relational bevorzugen.';
