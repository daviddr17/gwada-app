-- Facebook Messenger: Restaurant-Verbindung + Berechtigung integrations.facebook.

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.facebook'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_key_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_key_check
  check (integration_key in ('whatsapp', 'email', 'facebook'));

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_status_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_status_check
  check (
    (
      integration_key = 'whatsapp'
      and status in (
        'disconnected',
        'starting',
        'scan_qr',
        'working',
        'failed',
        'stopped'
      )
    )
    or (
      integration_key = 'email'
      and status in ('default', 'custom')
    )
    or (
      integration_key = 'facebook'
      and status in ('disconnected', 'working')
    )
  );

drop policy if exists restaurant_integrations_write_per_key on public.restaurant_integrations;

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
    or (
      integration_key = 'facebook'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.facebook')
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
    or (
      integration_key = 'facebook'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.facebook')
    )
  );
