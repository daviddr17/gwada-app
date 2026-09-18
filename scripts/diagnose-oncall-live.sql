-- Read-only: warum On-Call-Mails feuern. Keine Secrets, keine Empfänger.

\pset pager off

\echo '=== alert state ==='
select alert_key,
       last_sent_at,
       last_fingerprint
from public.platform_alert_state
order by alert_key;

\echo '=== pageable cron lag ==='
select job_name,
       last_ok_at,
       extract(epoch from (now() - last_ok_at))::int as lag_seconds,
       left(regexp_replace(coalesce(last_error, ''), '[[:cntrl:]]', ' ', 'g'), 160) as last_error
from public.platform_cron_heartbeats
where job_name in (
  'reservation-whatsapp',
  'reservation-email',
  'reservation-whatsapp-slo',
  'notification-deliver',
  'staff-shift-notifications',
  'waha-session-recover'
)
order by job_name;

\echo '=== waha not working ==='
select r.name,
       i.status,
       left(regexp_replace(coalesce(i.last_error, ''), '[[:cntrl:]]', ' ', 'g'), 140) as last_error
from public.restaurant_integrations i
join public.restaurants r on r.id = i.restaurant_id
where i.integration_key = 'whatsapp'
  and lower(coalesce(i.status, '')) <> 'working'
order by r.name;

\echo '=== hung or failed whatsapp outbox ==='
select r.name,
       o.message_kind,
       left(regexp_replace(coalesce(o.last_error, ''), '[[:cntrl:]]', ' ', 'g'), 120) as last_error,
       o.claimed_at,
       o.send_at
from public.reservation_whatsapp_outbox o
join public.restaurants r on r.id = o.restaurant_id
where o.sent_at is null
  and o.cancelled_at is null
  and o.send_at > now() - interval '14 days'
  and o.last_error is not null
order by o.send_at desc
limit 25;

\echo '=== hung or failed email outbox ==='
select r.name,
       o.message_kind,
       left(regexp_replace(coalesce(o.last_error, ''), '[[:cntrl:]]', ' ', 'g'), 120) as last_error,
       o.claimed_at,
       o.send_at
from public.reservation_email_outbox o
join public.restaurants r on r.id = o.restaurant_id
where o.sent_at is null
  and o.cancelled_at is null
  and o.send_at > now() - interval '14 days'
  and o.last_error is not null
order by o.send_at desc
limit 25;

\echo '=== stuck notification deliveries ==='
select r.name,
       d.channel,
       d.status,
       d.scheduled_at,
       left(regexp_replace(coalesce(d.last_error, ''), '[[:cntrl:]]', ' ', 'g'), 120) as last_error
from public.notification_deliveries d
join public.restaurants r on r.id = d.context_restaurant_id
where d.status in ('pending', 'failed')
  and d.created_at > now() - interval '14 days'
  and (
    d.status = 'failed'
    or d.scheduled_at < now() - interval '15 minutes'
  )
order by d.scheduled_at desc
limit 25;
