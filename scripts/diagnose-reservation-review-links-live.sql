-- One-off: Daniel Dreyer (zurschlagd) — alle Push-Kanäle (WhatsApp/E-Mail) aus.
-- Profil ohne profiles.phone → WhatsApp-Deliveries liefen mit no_phone fehl.
-- In-App-Prefs bleiben unverändert.

begin;

update public.user_restaurant_notification_preferences
set
  channel_whatsapp_enabled = false,
  channel_email_enabled = false,
  push_whatsapp_modules = (
    select coalesce(jsonb_object_agg(key, 'false'::jsonb), '{}'::jsonb)
    from jsonb_each(coalesce(push_whatsapp_modules, '{}'::jsonb))
  ),
  push_email_modules = (
    select coalesce(jsonb_object_agg(key, 'false'::jsonb), '{}'::jsonb)
    from jsonb_each(coalesce(push_email_modules, '{}'::jsonb))
  ),
  updated_at = now()
where profile_id = 'd2103096-3748-4a9c-be39-6fa2c2cf5d6f';

select
  profile_id,
  restaurant_id,
  channel_whatsapp_enabled,
  channel_email_enabled,
  push_whatsapp_modules,
  push_email_modules
from public.user_restaurant_notification_preferences
where profile_id = 'd2103096-3748-4a9c-be39-6fa2c2cf5d6f';

commit;
