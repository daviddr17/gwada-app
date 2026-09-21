-- Cap app logins (restaurant_employees): Free 1, Basic 3. Pro / legacy / complimentary unlimited.

create or replace function public.restaurant_can_add_registered_user(p_restaurant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_status text;
  v_source text;
  v_past_due timestamptz;
  v_used int;
  v_limit int;
begin
  select s.plan_id, s.status, s.source, s.past_due_since
  into v_plan, v_status, v_source, v_past_due
  from public.restaurant_subscriptions s
  where s.restaurant_id = p_restaurant_id;

  if v_source in ('legacy', 'complimentary') or v_status = 'legacy' then
    return true;
  end if;

  if v_source = 'stripe'
     and v_status in ('past_due', 'unpaid')
     and v_past_due is not null
     and v_past_due <= timezone('utc', now()) - interval '7 days' then
    v_plan := 'free';
  end if;

  if v_plan = 'pro' and coalesce(v_status, 'active') not in ('canceled', 'incomplete') then
    return true;
  end if;

  select count(*)::int into v_used
  from public.restaurant_employees e
  where e.restaurant_id = p_restaurant_id
    and e.is_active is true;

  v_limit := case when v_plan = 'basic' then 3 else 1 end;
  return v_used < v_limit;
end;
$$;

create or replace function public.enforce_registered_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.restaurant_id::text)::bigint);

  if tg_op = 'INSERT' then
    if new.is_active is true
       and not public.restaurant_can_add_registered_user(new.restaurant_id) then
      raise exception 'user_limit' using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_active is true
       and coalesce(old.is_active, false) is not true
       and not public.restaurant_can_add_registered_user(new.restaurant_id) then
      raise exception 'user_limit' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_employees_registered_user_limit
  on public.restaurant_employees;
create trigger restaurant_employees_registered_user_limit
  before insert or update of is_active
  on public.restaurant_employees
  for each row
  execute function public.enforce_registered_user_limit();

revoke all on function public.restaurant_can_add_registered_user(uuid) from public;
grant execute on function public.restaurant_can_add_registered_user(uuid) to service_role;
revoke all on function public.enforce_registered_user_limit() from public;
