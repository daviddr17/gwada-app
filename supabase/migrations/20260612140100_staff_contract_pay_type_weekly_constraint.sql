-- Vergütung: Festlohn pro Woche (Schritt 2 — Check-Constraint)

alter table public.restaurant_staff_contracts
  drop constraint if exists restaurant_staff_contracts_fixed;

alter table public.restaurant_staff_contracts
  add constraint restaurant_staff_contracts_fixed check (
    pay_type not in ('fixed', 'fixed_weekly')
    or (fixed_salary_cents is not null and fixed_salary_cents > 0)
  );

comment on column public.restaurant_staff_contracts.fixed_salary_cents is
  'Festlohn in Cent — bei pay_type fixed monatlich, bei fixed_weekly wöchentlich.';
