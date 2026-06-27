-- Protokoll: Vertrag ohne Unterschrift vorbereitet.

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
      'prepared'
    )
  );
