-- Online-Status: last_seen_at + Heartbeat; Superadmin sieht is_online (5-Minuten-Fenster).

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Letzter App-Heartbeat des Users; für Superadmin-Online-Anzeige (≈5 Min. gültig).';

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);

-- Heartbeat: nur eigenes Profil, auth required
create or replace function public.touch_profile_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
  set last_seen_at = timezone('utc', now())
  where id = auth.uid();
end;
$$;

revoke all on function public.touch_profile_last_seen() from public;
grant execute on function public.touch_profile_last_seen() to authenticated;

-- Superadmin: User-Liste inkl. Online-Flag (Return-Typ ändert sich → drop nötig)
drop function if exists public.superadmin_list_users();

create function public.superadmin_list_users()
returns table (
  profile_id uuid,
  email text,
  given_name text,
  family_name text,
  display_name text,
  phone text,
  locale text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  is_online boolean,
  restaurant_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    p.id as profile_id,
    u.email::text as email,
    p.given_name,
    p.family_name,
    p.display_name,
    p.phone,
    p.locale,
    p.created_at,
    u.last_sign_in_at,
    p.last_seen_at,
    (
      p.last_seen_at is not null
      and p.last_seen_at >= timezone('utc', now()) - interval '5 minutes'
    ) as is_online,
    coalesce(ec.cnt, 0)::bigint as restaurant_count
  from public.profiles p
  inner join auth.users u on u.id = p.id
  left join lateral (
    select count(*)::bigint as cnt
    from public.restaurant_employees re
    where re.profile_id = p.id
      and re.is_active = true
  ) ec on true
  order by p.created_at desc;
end;
$$;

revoke all on function public.superadmin_list_users() from public;
grant execute on function public.superadmin_list_users() to authenticated;
