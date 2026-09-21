-- Outbox: Beleg (WAHA-Message-ID) + Versuche. Claim für Sofort-Retries
-- (Bestätigung etc.), nachdem Historie belegt hat, dass nichts rausging.

alter table public.reservation_whatsapp_outbox
  add column if not exists waha_message_id text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create or replace function public.claim_reservation_whatsapp_outbox_retries(
  p_limit integer default 10
)
returns table (
  id uuid,
  reservation_id uuid,
  message_kind text,
  send_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_stale_reservation_whatsapp_outbox(10);

  return query
    update public.reservation_whatsapp_outbox o
    set claimed_at = timezone('utc', now())
    from (
      select w.id
      from public.reservation_whatsapp_outbox w
      where w.sent_at is null
        and w.cancelled_at is null
        and w.message_kind in (
          'received',
          'confirmed',
          'cancelled',
          'declined',
          'no_show'
        )
        and w.send_at > timezone('utc', now()) - interval '45 minutes'
        and w.send_at <= timezone('utc', now())
        and (
          w.claimed_at is null
          or w.claimed_at < timezone('utc', now()) - interval '90 seconds'
        )
      order by w.send_at desc
      limit greatest(1, least(p_limit, 50))
      for update skip locked
    ) picked
    where o.id = picked.id
    returning o.id, o.reservation_id, o.message_kind, o.send_at;
end;
$$;

revoke all on function public.claim_reservation_whatsapp_outbox_retries(integer) from public;
grant execute on function public.claim_reservation_whatsapp_outbox_retries(integer) to service_role;
