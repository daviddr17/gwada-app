-- WAHA message.ack Webhook: leises Inbox-Refresh ohne „Neue Nachricht“-Toast.

alter table public.restaurant_inbox_signals
  drop constraint if exists restaurant_inbox_signals_source_check;

alter table public.restaurant_inbox_signals
  add constraint restaurant_inbox_signals_source_check check (
    source in ('waha', 'waha_ack', 'email')
  );

comment on column public.restaurant_inbox_signals.source is
  'waha = neue WAHA-Aktivität; waha_ack = Lese-/ACK-Update; email = IMAP-Hinweis.';
