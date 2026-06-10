-- Status-Farbe für Buchführungs-Chips

alter table public.accounting_document_statuses
  add column if not exists color_hex text not null default '#64748b'
    constraint accounting_document_statuses_color_hex_format
      check (color_hex ~ '^#[0-9A-Fa-f]{6}$');

update public.accounting_document_statuses set color_hex = '#0ea5e9' where code = 'open';
update public.accounting_document_statuses set color_hex = '#22c55e' where code = 'paid';
update public.accounting_document_statuses set color_hex = '#64748b' where code = 'voided';
update public.accounting_document_statuses set color_hex = '#e11d48' where code = 'overdue';
update public.accounting_document_statuses set color_hex = '#94a3b8' where code = 'draft';
update public.accounting_document_statuses set color_hex = '#06b6d4' where code = 'sent';
update public.accounting_document_statuses set color_hex = '#22c55e' where code = 'accepted';
update public.accounting_document_statuses set color_hex = '#f97316' where code = 'rejected';
update public.accounting_document_statuses set color_hex = '#eab308' where code = 'unchecked';
