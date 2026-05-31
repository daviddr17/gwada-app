-- Protokoll: Einladungen per E-Mail / WhatsApp

alter table public.restaurant_staff_log_entries
  drop constraint if exists restaurant_staff_log_entries_action_check;

alter table public.restaurant_staff_log_entries
  add constraint restaurant_staff_log_entries_action_check
  check (action in ('created', 'updated', 'invite_email', 'invite_whatsapp'));
