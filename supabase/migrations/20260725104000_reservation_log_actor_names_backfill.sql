-- Protokoll „Angelegt“: fehlende Actor-Namen aus Mitarbeiter/Profil nachziehen.
-- Altbestand hatte oft nur actor_user_id (ohne actorGivenName/actorFamilyName).
-- LATERAL: Ziel-Alias `e` darf in JOIN-ON von FROM nicht direkt referenziert werden (PG).

update public.restaurant_reservation_log_entries e
set details =
  e.details
  || jsonb_strip_nulls(
    jsonb_build_object(
      'actorGivenName',
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
      ),
      'actorFamilyName',
      coalesce(
        nullif(trim(s.family_name), ''),
        nullif(trim(p.family_name), ''),
        ''
      ),
      'actorSource',
      coalesce(nullif(e.details->>'actorSource', ''), 'staff')
    )
  )
from public.profiles p
left join lateral (
  select s.given_name, s.family_name
  from public.restaurant_staff s
  where s.profile_id = p.id
    and s.restaurant_id = e.restaurant_id
  order by s.created_at nulls last
  limit 1
) s on true
where e.actor_user_id = p.id
  and e.actor_user_id is not null
  and coalesce(e.details->>'actorSource', '') is distinct from 'guest'
  and coalesce(nullif(trim(e.details->>'actorGivenName'), ''), '') = ''
  and coalesce(nullif(trim(e.details->>'actorFamilyName'), ''), '') = ''
  and (
    nullif(trim(coalesce(s.given_name, '')), '') is not null
    or nullif(trim(coalesce(s.family_name, '')), '') is not null
    or nullif(trim(coalesce(p.given_name, '')), '') is not null
    or nullif(trim(coalesce(p.family_name, '')), '') is not null
    or nullif(trim(coalesce(p.display_name, '')), '') is not null
  );
