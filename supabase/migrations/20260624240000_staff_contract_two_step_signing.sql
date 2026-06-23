-- Optionale Zweit-Unterschrift: MA unterschreibt im eigenen Profil.

alter table public.restaurant_staff_module_settings
  add column if not exists contract_two_step_signing boolean not null default false;

comment on column public.restaurant_staff_module_settings.contract_two_step_signing is
  'Wenn true: HR unterschreibt als Arbeitgeber, MA unterschreibt danach im Profil. Sonst beide Unterschriften in einer Session.';

alter table public.restaurant_staff_contracts
  add column if not exists employee_signature_pending boolean not null default false;

comment on column public.restaurant_staff_contracts.employee_signature_pending is
  'Vertrag wartet auf Unterschrift des Mitarbeiters im Profil (Zweit-Schritt-Modus).';

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
      'employee_signed'
    )
  );
