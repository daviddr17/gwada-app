-- Read-only: Daniel Dreyer Push-Prefs + letzte Deliveries (Live)

\echo === Staff / Profile ===
select
  rs.id as staff_id,
  rs.restaurant_id,
  r.slug as restaurant_slug,
  rs.profile_id,
  rs.given_name,
  rs.family_name,
  rs.email as staff_email,
  rs.phone as staff_phone,
  p.phone as profile_phone,
  p.notification_email,
  u.email as auth_email
from public.restaurant_staff rs
left join public.restaurants r on r.id = rs.restaurant_id
left join public.profiles p on p.id = rs.profile_id
left join auth.users u on u.id = rs.profile_id
where rs.id = 'c544f5de-7bfb-4be0-9856-f8d2caf4f735'
   or rs.profile_id = 'd2103096-3748-4a9c-be39-6fa2c2cf5d6f'
   or (
     rs.given_name ilike 'Daniel'
     and rs.family_name ilike 'Dreyer'
   );

\echo === Notification preferences ===
select
  prefs.restaurant_id,
  prefs.profile_id,
  prefs.channel_whatsapp_enabled,
  prefs.channel_email_enabled,
  prefs.push_whatsapp_modules,
  prefs.push_email_modules,
  prefs.in_app_modules,
  prefs.updated_at
from public.user_restaurant_notification_preferences prefs
where prefs.profile_id = 'd2103096-3748-4a9c-be39-6fa2c2cf5d6f'
order by prefs.updated_at desc nulls last;

\echo === Recent deliveries (last 40) ===
select
  d.id,
  d.channel,
  d.status,
  d.attempts,
  d.last_error,
  d.scheduled_at,
  d.sent_at,
  d.created_at,
  e.module,
  e.reference_id,
  e.created_at as event_at
from public.notification_deliveries d
join public.notification_events e on e.id = d.event_id
where d.profile_id = 'd2103096-3748-4a9c-be39-6fa2c2cf5d6f'
order by coalesce(d.sent_at, d.created_at) desc
limit 40;

\echo === Delivery status counts ===
select d.status, d.channel, count(*) as n
from public.notification_deliveries d
where d.profile_id = 'd2103096-3748-4a9c-be39-6fa2c2cf5d6f'
group by d.status, d.channel
order by d.status, d.channel;
