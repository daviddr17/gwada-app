-- Plattform-E-Mail-Integration + Sichtbarkeits-RPC für WhatsApp/E-Mail.

insert into public.platform_integrations (key, enabled, config)
values ('email', false, '{}'::jsonb)
on conflict (key) do nothing;

create or replace function public.platform_messaging_flags()
returns table (whatsapp_enabled boolean, email_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'whatsapp'),
      false
    ) as whatsapp_enabled,
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'email'),
      false
    ) as email_enabled;
$$;

revoke all on function public.platform_messaging_flags() from public;
grant execute on function public.platform_messaging_flags() to authenticated;
