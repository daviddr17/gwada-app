-- Berechtigung integrations.email + RLS + Seed für Inhaber/Manager.

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.email'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

drop policy if exists restaurant_integrations_write_whatsapp on public.restaurant_integrations;
drop policy if exists restaurant_integrations_write_managers on public.restaurant_integrations;

create policy restaurant_integrations_write_per_key
  on public.restaurant_integrations for all
  to authenticated
  using (
    (
      integration_key = 'whatsapp'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.whatsapp')
    )
    or (
      integration_key = 'email'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.email')
    )
  )
  with check (
    (
      integration_key = 'whatsapp'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.whatsapp')
    )
    or (
      integration_key = 'email'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.email')
    )
  );
