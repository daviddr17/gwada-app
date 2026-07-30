-- Verwaiste/abgelaufene offene Display-Sessions bei zurschlagd schließen
-- (kein Heartbeat seit > auto_lock_seconds).

update public.restaurant_display_sessions s
set ended_at = timezone('utc', now())
from public.restaurant_displays d
where s.display_id = d.id
  and d.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and s.ended_at is null
  and s.last_activity_at <
    timezone('utc', now()) - make_interval(secs => greatest(d.auto_lock_seconds, 60));

select
  s.id,
  d.name,
  s.staff_id,
  s.last_activity_at,
  s.ended_at
from public.restaurant_display_sessions s
join public.restaurant_displays d on d.id = s.display_id
where d.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and s.ended_at is null
order by s.last_activity_at desc;
