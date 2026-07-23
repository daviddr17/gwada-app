-- Live: zurschlagd — doppelten Mitarbeiter „David Dreyer“ in den Inhaber-Staff mergen.
-- Schichten, Zeiten, Verträge usw. → Inhaber-Staff; Duplikat löschen.
-- Idempotent: wenn nur noch ein David-Dreyer-Staff existiert → no-op.

do $$
declare
  v_rid uuid;
  v_keeper uuid;
  v_dup uuid;
  v_keeper_emp uuid;
  v_dup_emp uuid;
  v_cnt int;
  r record;
begin
  select id into v_rid
  from public.restaurants
  where slug = 'zurschlagd'
  limit 1;

  if v_rid is null then
    raise exception 'merge-david: Restaurant zurschlagd nicht gefunden';
  end if;

  -- Inhaber-Staff: David Dreyer mit Owner-Rolle/Position
  select rs.id, re.id
  into v_keeper, v_keeper_emp
  from public.restaurant_staff rs
  left join public.restaurant_employees re
    on re.id = rs.employee_id
    or (re.staff_id = rs.id and re.restaurant_id = rs.restaurant_id)
  left join public.restaurant_positions rp
    on rp.id = coalesce(rs.restaurant_position_id, re.position_id)
  where rs.restaurant_id = v_rid
    and rs.given_name ilike 'David'
    and rs.family_name ilike 'Dreyer'
    and (
      re.role = 'owner'
      or rp.slug = 'owner'
    )
  order by rs.created_at asc
  limit 1;

  if v_keeper is null then
    raise exception 'merge-david: Inhaber-Staff „David Dreyer“ nicht gefunden';
  end if;

  -- Duplikat: anderer David Dreyer ohne Owner-Kennzeichnung
  select rs.id, re.id
  into v_dup, v_dup_emp
  from public.restaurant_staff rs
  left join public.restaurant_employees re
    on re.id = rs.employee_id
    or (re.staff_id = rs.id and re.restaurant_id = rs.restaurant_id)
  left join public.restaurant_positions rp
    on rp.id = coalesce(rs.restaurant_position_id, re.position_id)
  where rs.restaurant_id = v_rid
    and rs.id <> v_keeper
    and rs.given_name ilike 'David'
    and rs.family_name ilike 'Dreyer'
    and coalesce(re.role::text, '') is distinct from 'owner'
    and coalesce(rp.slug, '') is distinct from 'owner'
  order by rs.created_at asc
  limit 1;

  if v_dup is null then
    raise notice 'merge-david: kein Duplikat — nichts zu tun (keeper %)', v_keeper;
    return;
  end if;

  raise notice 'merge-david: restaurant=% keeper=% dup=%', v_rid, v_keeper, v_dup;

  -- Vorschau
  for r in
    select 'scheduled_shifts' as kind, count(*)::int as n
      from public.restaurant_staff_scheduled_shifts where staff_id = v_dup
    union all
    select 'work_entries', count(*)::int
      from public.restaurant_staff_work_entries where staff_id = v_dup
    union all
    select 'contracts', count(*)::int
      from public.restaurant_staff_contracts where staff_id = v_dup
    union all
    select 'availability_slots', count(*)::int
      from public.restaurant_staff_availability_slots where staff_id = v_dup
    union all
    select 'wage_advances', count(*)::int
      from public.restaurant_staff_wage_advances where staff_id = v_dup
    union all
    select 'documents', count(*)::int
      from public.restaurant_documents where staff_id = v_dup
    union all
    select 'invites', count(*)::int
      from public.restaurant_staff_invites where staff_id = v_dup
    union all
    select 'log_entries', count(*)::int
      from public.restaurant_staff_log_entries where staff_id = v_dup
    union all
    select 'display_time_requests', count(*)::int
      from public.restaurant_staff_display_time_requests where staff_id = v_dup
    union all
    select 'display_sessions', count(*)::int
      from public.restaurant_display_sessions where staff_id = v_dup
    union all
    select 'pos_sessions', count(*)::int
      from public.restaurant_pos_sessions where staff_id = v_dup
  loop
    raise notice 'merge-david: dup.% = %', r.kind, r.n;
  end loop;

  -- Offene Work-Entries: Konflikt vermeiden (max. eine offene Display-Schicht pro Staff)
  if exists (
    select 1
    from public.restaurant_staff_work_entries a
    where a.staff_id = v_dup
      and a.is_open
      and a.shift_id is not null
      and exists (
        select 1
        from public.restaurant_staff_work_entries b
        where b.staff_id = v_keeper
          and b.is_open
          and b.shift_id is not null
      )
  ) then
    update public.restaurant_staff_work_entries
    set
      is_open = false,
      ends_at = coalesce(ends_at, timezone('utc', now()))
    where staff_id = v_dup
      and is_open
      and shift_id is not null;
    raise notice 'merge-david: offene Duplikat-Display-Schicht geschlossen (Keeper hatte schon eine offene)';
  end if;

  -- Todo-Assignees: PK-Kollisionen entfernen
  delete from public.restaurant_staff_todo_staff_assignees a
  using public.restaurant_staff_todo_staff_assignees b
  where a.staff_id = v_dup
    and b.staff_id = v_keeper
    and a.todo_id = b.todo_id;

  delete from public.restaurant_compliance_checklist_staff_assignees a
  using public.restaurant_compliance_checklist_staff_assignees b
  where a.staff_id = v_dup
    and b.staff_id = v_keeper
    and a.checklist_id = b.checklist_id;

  -- Todo-Completions: Unique (todo_id, staff_id, period_start)
  delete from public.restaurant_staff_todo_completions a
  using public.restaurant_staff_todo_completions b
  where a.staff_id = v_dup
    and b.staff_id = v_keeper
    and a.todo_id = b.todo_id
    and a.period_start is not distinct from b.period_start;

  -- Employee-Link des Duplikats lösen (unique staff_id)
  update public.restaurant_employees
  set staff_id = null
  where staff_id = v_dup
    and id is distinct from v_keeper_emp;

  update public.restaurant_staff
  set employee_id = null
  where id = v_dup;

  -- Reassign
  update public.restaurant_staff_scheduled_shifts
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_work_entries
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_contracts
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_availability_slots
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_wage_advances
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_documents
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_invites
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_log_entries
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_display_time_requests
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_display_sessions
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_pos_sessions
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_todos
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_compliance_checklists
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_todo_staff_assignees
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_compliance_checklist_staff_assignees
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_todo_completions
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_todo_deferrals
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_staff_todo_log_entries
  set actor_staff_id = v_keeper where actor_staff_id = v_dup;

  update public.restaurant_compliance_deferrals
  set staff_id = v_keeper where staff_id = v_dup;

  update public.restaurant_compliance_records
  set performed_by_staff_id = v_keeper where performed_by_staff_id = v_dup;

  update public.restaurant_compliance_log_entries
  set actor_staff_id = v_keeper where actor_staff_id = v_dup;

  -- Keeper-Felder auffüllen (nur leere)
  update public.restaurant_staff k
  set
    email = coalesce(nullif(trim(k.email), ''), nullif(trim(d.email), '')),
    phone = coalesce(nullif(trim(k.phone), ''), nullif(trim(d.phone), '')),
    birth_date = coalesce(k.birth_date, d.birth_date),
    nationality = coalesce(nullif(trim(k.nationality), ''), nullif(trim(d.nationality), '')),
    address_line1 = coalesce(nullif(trim(k.address_line1), ''), nullif(trim(d.address_line1), '')),
    address_line2 = coalesce(nullif(trim(k.address_line2), ''), nullif(trim(d.address_line2), '')),
    postal_code = coalesce(nullif(trim(k.postal_code), ''), nullif(trim(d.postal_code), '')),
    city = coalesce(nullif(trim(k.city), ''), nullif(trim(d.city), '')),
    country = coalesce(nullif(trim(k.country), ''), nullif(trim(d.country), '')),
    position_tag_id = coalesce(k.position_tag_id, d.position_tag_id),
    avatar_storage_path = coalesce(k.avatar_storage_path, d.avatar_storage_path),
    display_pin_set_at = coalesce(k.display_pin_set_at, d.display_pin_set_at)
  from public.restaurant_staff d
  where k.id = v_keeper
    and d.id = v_dup;

  -- Display-PIN vom Duplikat nur übernehmen, wenn Keeper keine hat
  update public.restaurant_staff k
  set
    display_pin_hash = d.display_pin_hash,
    display_pin_offline_hash = d.display_pin_offline_hash,
    display_pin_set_at = coalesce(k.display_pin_set_at, d.display_pin_set_at)
  from public.restaurant_staff d
  where k.id = v_keeper
    and d.id = v_dup
    and k.display_pin_hash is null
    and d.display_pin_hash is not null;

  -- Doppelte Employee-Mitgliedschaft des Duplikats deaktivieren (nicht Owner)
  if v_dup_emp is not null and v_dup_emp is distinct from v_keeper_emp then
    update public.restaurant_employees
    set
      is_active = false,
      staff_id = null
    where id = v_dup_emp
      and role is distinct from 'owner';
    raise notice 'merge-david: Duplikat-Employee % deaktiviert', v_dup_emp;
  end if;

  delete from public.restaurant_staff
  where id = v_dup
    and restaurant_id = v_rid;

  get diagnostics v_cnt = row_count;
  if v_cnt <> 1 then
    raise exception 'merge-david: Löschen des Duplikats fehlgeschlagen (rows=%)', v_cnt;
  end if;

  -- Sicherstellen, dass Owner-Link steht
  perform public.ensure_restaurant_owner_staff(v_rid);

  raise notice 'merge-david: fertig — Duplikat % → Keeper %', v_dup, v_keeper;
end $$;

-- Verifikation
select
  rs.id,
  rs.given_name,
  rs.family_name,
  rs.is_active,
  rp.slug as position_slug,
  re.role as employee_role,
  (
    select count(*) from public.restaurant_staff_scheduled_shifts s where s.staff_id = rs.id
  ) as shifts,
  (
    select count(*) from public.restaurant_staff_work_entries w where w.staff_id = rs.id
  ) as work_entries,
  (
    select count(*) from public.restaurant_staff_contracts c where c.staff_id = rs.id
  ) as contracts
from public.restaurant_staff rs
left join public.restaurant_employees re
  on re.staff_id = rs.id or re.id = rs.employee_id
left join public.restaurant_positions rp
  on rp.id = coalesce(rs.restaurant_position_id, re.position_id)
where rs.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and rs.given_name ilike 'David'
  and rs.family_name ilike 'Dreyer'
order by rs.created_at;
