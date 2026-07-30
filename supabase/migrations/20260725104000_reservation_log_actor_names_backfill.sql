-- Protokoll „Angelegt“: fehlende Actor-Namen aus Mitarbeiter/Profil nachziehen.
-- Altbestand hatte oft nur actor_user_id (ohne actorGivenName/actorFamilyName).
-- Auflösung in CTE (UPDATE…FROM darf Ziel-Alias `e` nicht in JOIN/LATERAL referenzieren).

with resolved as (
  select
    e.id,
    coalesce(
      nullif(trim(s.given_name), ''),
      nullif(trim(p.given_name), ''),
      case
        when nullif(trim(coalesce(s.family_name, '')), '') is null
          and nullif(trim(coalesce(p.family_name, '')), '') is null
        then nullif(trim(p.display_name), '')
        else null
      end,
      ''
    ) as actor_given_name,
    coalesce(
      nullif(trim(s.family_name), ''),
      nullif(trim(p.family_name), ''),
      ''
    ) as actor_family_name,
    coalesce(nullif(e.details->>'actorSource', ''), 'staff') as actor_source
  from public.restaurant_reservation_log_entries e
  join public.profiles p
    on p.id = e.actor_user_id
  left join lateral (
    select s.given_name, s.family_name
    from public.restaurant_staff s
    where s.profile_id = p.id
      and s.restaurant_id = e.restaurant_id
    order by s.created_at nulls last
    limit 1
  ) s on true
  where e.actor_user_id is not null
    and coalesce(e.details->>'actorSource', '') is distinct from 'guest'
    and coalesce(nullif(trim(e.details->>'actorGivenName'), ''), '') = ''
    and coalesce(nullif(trim(e.details->>'actorFamilyName'), ''), '') = ''
    and (
      nullif(trim(coalesce(s.given_name, '')), '') is not null
      or nullif(trim(coalesce(s.family_name, '')), '') is not null
      or nullif(trim(coalesce(p.given_name, '')), '') is not null
      or nullif(trim(coalesce(p.family_name, '')), '') is not null
      or nullif(trim(coalesce(p.display_name, '')), '') is not null
    )
)
update public.restaurant_reservation_log_entries e
set details =
  e.details
  || jsonb_strip_nulls(
    jsonb_build_object(
      'actorGivenName', r.actor_given_name,
      'actorFamilyName', r.actor_family_name,
      'actorSource', r.actor_source
    )
  )
from resolved r
where e.id = r.id;
