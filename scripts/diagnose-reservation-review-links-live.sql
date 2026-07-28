-- Diagnose: Danke-Nachrichten ohne Bewertungslink (nur lesen)
\echo === restaurant settings (zurschlagd) ===
select
  r.slug,
  s.whatsapp_thanks_enabled,
  s.whatsapp_review_include_gwada,
  s.whatsapp_review_include_google,
  s.whatsapp_review_include_facebook,
  s.email_thanks_enabled,
  s.email_review_include_gwada,
  s.email_review_include_google,
  s.email_review_include_facebook,
  s.review_request_enabled,
  s.review_google_url is not null as has_google_url
from public.restaurants r
join public.restaurant_reservation_settings s on s.restaurant_id = r.id
where r.slug = 'zurschlagd';

\echo === recent whatsapp thanks outbox ===
select
  o.id,
  o.reservation_id,
  o.sent_at,
  o.cancelled_at,
  o.last_error,
  o.send_at,
  (i.token is not null) as has_invitation,
  i.created_at as invitation_created_at,
  i.completed_at as invitation_completed_at
from public.reservation_whatsapp_outbox o
join public.restaurants r on r.id = o.restaurant_id
left join public.gwada_review_invitations i on i.reservation_id = o.reservation_id
where r.slug = 'zurschlagd'
  and o.message_kind = 'thanks'
order by coalesce(o.sent_at, o.send_at) desc nulls last
limit 20;

\echo === invitations created around last drain (last 48h) ===
select
  i.id,
  i.reservation_id,
  i.created_at,
  i.completed_at,
  i.expires_at,
  left(i.token, 8) as token_prefix
from public.gwada_review_invitations i
join public.restaurants r on r.id = i.restaurant_id
where r.slug = 'zurschlagd'
  and i.created_at > now() - interval '48 hours'
order by i.created_at desc
limit 30;

\echo === thanks sent without invitation ===
select count(*) as thanks_sent_without_invitation
from public.reservation_whatsapp_outbox o
join public.restaurants r on r.id = o.restaurant_id
left join public.gwada_review_invitations i on i.reservation_id = o.reservation_id
where r.slug = 'zurschlagd'
  and o.message_kind = 'thanks'
  and o.sent_at is not null
  and i.id is null;
