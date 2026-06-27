-- Externe Verträge: PDF-Upload statt Plattform-Erstellung.

alter table public.restaurant_staff_contracts
  add column if not exists contract_source text not null default 'platform';

alter table public.restaurant_staff_contracts
  drop constraint if exists restaurant_staff_contracts_source_check;

alter table public.restaurant_staff_contracts
  add constraint restaurant_staff_contracts_source_check
  check (contract_source in ('platform', 'external'));

comment on column public.restaurant_staff_contracts.contract_source is
  'platform = über Gwada erstellt/unterschrieben; external = PDF-Upload außerhalb der Plattform.';

alter table public.restaurant_staff_contract_log_entries
  drop constraint if exists restaurant_staff_contract_log_entries_action_check;

alter table public.restaurant_staff_contract_log_entries
  add constraint restaurant_staff_contract_log_entries_action_check
  check (
    action in (
      'created',
      'updated',
      'signed',
      'revised',
      'pdf_version',
      'employer_signed',
      'employee_signed',
      'prepared',
      'external_uploaded'
    )
  );
