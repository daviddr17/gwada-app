-- Restaurant-Abo: Belege für billing.manage + lesbare Rechnungsnummer

alter table public.restaurant_billing_invoices
  add column if not exists number text;

comment on column public.restaurant_billing_invoices.number is
  'Stripe invoice.number (z. B. ABC-0003), für Belege in der App.';

drop policy if exists restaurant_billing_invoices_tenant_select
  on public.restaurant_billing_invoices;
create policy restaurant_billing_invoices_tenant_select
  on public.restaurant_billing_invoices for select
  to authenticated
  using (
    restaurant_id is not null
    and public.auth_has_restaurant_permission(restaurant_id, 'billing.manage')
  );
