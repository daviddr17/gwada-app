-- Rückfüllung: Protokoll aus bestehenden Metadaten (created_at, sent_at, Quelle, Nummer).
-- Idempotent — überspringt Dokumente, die bereits Protokolleinträge haben.

create or replace function public.accounting_log_profile_details(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'actorGivenName', coalesce(p.given_name, ''),
        'actorFamilyName', coalesce(p.family_name, '')
      )
      from public.profiles p
      where p.id = p_user_id
    ),
    '{}'::jsonb
  );
$$;

-- Rechnungen: angelegt
insert into public.accounting_document_log_entries (
  restaurant_id,
  document_kind,
  document_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  i.restaurant_id,
  'invoice',
  i.id,
  i.created_by,
  'created',
  public.accounting_log_profile_details(i.created_by)
    || jsonb_build_object(
      'backfilled', true,
      'source', i.source,
      'voucherNumber', i.voucher_number,
      'documentVariant', i.document_variant,
      'summary',
      case
        when i.document_variant = 'correction' then
          case
            when orig.voucher_number is not null and btrim(orig.voucher_number) <> '' then
              'Korrektur zu ' || orig.voucher_number || ' angelegt'
              || coalesce(' (' || nullif(btrim(i.voucher_number), '') || ')', '')
            else
              'Korrektur angelegt'
              || coalesce(' (' || nullif(btrim(i.voucher_number), '') || ')', '')
          end
        when i.source = 'lexoffice' then
          'Rechnung aus Lexware importiert'
          || coalesce(' (' || nullif(btrim(i.voucher_number), '') || ')', '')
        else
          'Rechnung angelegt'
          || coalesce(' (' || nullif(btrim(i.voucher_number), '') || ')', '')
      end,
      'correctsNumber', orig.voucher_number
    ),
  i.created_at
from public.accounting_invoices i
left join public.accounting_invoices orig on orig.id = i.corrects_id
where not exists (
  select 1
  from public.accounting_document_log_entries l
  where l.document_kind = 'invoice'
    and l.document_id = i.id
    and l.action = 'created'
);

-- Rechnungen: versendet
insert into public.accounting_document_log_entries (
  restaurant_id,
  document_kind,
  document_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  i.restaurant_id,
  'invoice',
  i.id,
  coalesce(i.updated_by, i.created_by),
  'sent',
  public.accounting_log_profile_details(coalesce(i.updated_by, i.created_by))
    || jsonb_build_object(
      'backfilled', true,
      'voucherNumber', i.voucher_number,
      'channels', coalesce(i.sent_channels, '[]'::jsonb),
      'recipientName', i.recipient_snapshot ->> 'name',
      'recipientEmail', i.recipient_snapshot ->> 'email',
      'recipientPhone', i.recipient_snapshot ->> 'phone',
      'summary',
      trim(both ' ' from concat_ws(
        ' ',
        case
          when coalesce(i.sent_channels, '[]'::jsonb) @> '["email"]'::jsonb
            and coalesce(i.sent_channels, '[]'::jsonb) @> '["whatsapp"]'::jsonb then
            'E-Mail, WhatsApp'
          when coalesce(i.sent_channels, '[]'::jsonb) @> '["email"]'::jsonb then 'E-Mail'
          when coalesce(i.sent_channels, '[]'::jsonb) @> '["whatsapp"]'::jsonb then 'WhatsApp'
          when jsonb_array_length(coalesce(i.sent_channels, '[]'::jsonb)) > 0 then
            'Versendet'
          else 'Versendet'
        end,
        case
          when nullif(btrim(i.recipient_snapshot ->> 'name'), '') is not null then
            'an ' || (i.recipient_snapshot ->> 'name')
          else null
        end
      ))
    ),
  i.sent_at
from public.accounting_invoices i
where i.sent_at is not null
  and not exists (
    select 1
    from public.accounting_document_log_entries l
    where l.document_kind = 'invoice'
      and l.document_id = i.id
      and l.action = 'sent'
  );

-- Angebote: angelegt
insert into public.accounting_document_log_entries (
  restaurant_id,
  document_kind,
  document_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  q.restaurant_id,
  'quotation',
  q.id,
  q.created_by,
  'created',
  public.accounting_log_profile_details(q.created_by)
    || jsonb_build_object(
      'backfilled', true,
      'source', q.source,
      'voucherNumber', q.voucher_number,
      'summary',
      case
        when q.source = 'lexoffice' then
          'Angebot aus Lexware importiert'
          || coalesce(' (' || nullif(btrim(q.voucher_number), '') || ')', '')
        else
          'Angebot angelegt'
          || coalesce(' (' || nullif(btrim(q.voucher_number), '') || ')', '')
      end
    ),
  q.created_at
from public.accounting_quotations q
where not exists (
  select 1
  from public.accounting_document_log_entries l
  where l.document_kind = 'quotation'
    and l.document_id = q.id
    and l.action = 'created'
);

-- Angebote: versendet
insert into public.accounting_document_log_entries (
  restaurant_id,
  document_kind,
  document_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  q.restaurant_id,
  'quotation',
  q.id,
  coalesce(q.updated_by, q.created_by),
  'sent',
  public.accounting_log_profile_details(coalesce(q.updated_by, q.created_by))
    || jsonb_build_object(
      'backfilled', true,
      'voucherNumber', q.voucher_number,
      'channels', coalesce(q.sent_channels, '[]'::jsonb),
      'recipientName', q.recipient_snapshot ->> 'name',
      'recipientEmail', q.recipient_snapshot ->> 'email',
      'recipientPhone', q.recipient_snapshot ->> 'phone',
      'summary',
      trim(both ' ' from concat_ws(
        ' ',
        case
          when coalesce(q.sent_channels, '[]'::jsonb) @> '["email"]'::jsonb
            and coalesce(q.sent_channels, '[]'::jsonb) @> '["whatsapp"]'::jsonb then
            'E-Mail, WhatsApp'
          when coalesce(q.sent_channels, '[]'::jsonb) @> '["email"]'::jsonb then 'E-Mail'
          when coalesce(q.sent_channels, '[]'::jsonb) @> '["whatsapp"]'::jsonb then 'WhatsApp'
          when jsonb_array_length(coalesce(q.sent_channels, '[]'::jsonb)) > 0 then
            'Versendet'
          else 'Versendet'
        end,
        case
          when nullif(btrim(q.recipient_snapshot ->> 'name'), '') is not null then
            'an ' || (q.recipient_snapshot ->> 'name')
          else null
        end
      ))
    ),
  q.sent_at
from public.accounting_quotations q
where q.sent_at is not null
  and not exists (
    select 1
    from public.accounting_document_log_entries l
    where l.document_kind = 'quotation'
      and l.document_id = q.id
      and l.action = 'sent'
  );

-- Belege: angelegt
insert into public.accounting_document_log_entries (
  restaurant_id,
  document_kind,
  document_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  v.restaurant_id,
  'voucher',
  v.id,
  v.created_by,
  'created',
  public.accounting_log_profile_details(v.created_by)
    || jsonb_build_object(
      'backfilled', true,
      'source', v.source,
      'voucherNumber', v.voucher_number,
      'documentVariant', v.document_variant,
      'summary',
      case
        when v.document_variant = 'correction' then
          case
            when orig.voucher_number is not null and btrim(orig.voucher_number) <> '' then
              'Korrektur zu ' || orig.voucher_number || ' angelegt'
              || coalesce(' (' || nullif(btrim(v.voucher_number), '') || ')', '')
            else
              'Korrektur angelegt'
              || coalesce(' (' || nullif(btrim(v.voucher_number), '') || ')', '')
          end
        when v.source = 'lexoffice' then
          'Beleg aus Lexware importiert'
          || coalesce(' (' || nullif(btrim(v.voucher_number), '') || ')', '')
        else
          'Beleg angelegt'
          || coalesce(' (' || nullif(btrim(v.voucher_number), '') || ')', '')
      end,
      'correctsNumber', orig.voucher_number
    ),
  v.created_at
from public.accounting_vouchers v
left join public.accounting_vouchers orig on orig.id = v.corrects_id
where not exists (
  select 1
  from public.accounting_document_log_entries l
  where l.document_kind = 'voucher'
    and l.document_id = v.id
    and l.action = 'created'
);

-- Belege: Anhang (wenn Dateiname hinterlegt)
insert into public.accounting_document_log_entries (
  restaurant_id,
  document_kind,
  document_id,
  actor_user_id,
  action,
  details,
  created_at
)
select
  v.restaurant_id,
  'voucher',
  v.id,
  coalesce(v.updated_by, v.created_by),
  'attachment_uploaded',
  public.accounting_log_profile_details(coalesce(v.updated_by, v.created_by))
    || jsonb_build_object(
      'backfilled', true,
      'fileName', v.file_name,
      'summary', v.file_name
    ),
  coalesce(v.updated_at, v.created_at)
from public.accounting_vouchers v
where v.file_name is not null
  and btrim(v.file_name) <> ''
  and v.mime_type is distinct from 'lexoffice/file'
  and not exists (
    select 1
    from public.accounting_document_log_entries l
    where l.document_kind = 'voucher'
      and l.document_id = v.id
      and l.action = 'attachment_uploaded'
  );

drop function public.accounting_log_profile_details(uuid);
