-- Facebook-Integration: Plattform-Flag für Restaurant-UI (Superadmin schaltet frei).

drop function if exists public.platform_messaging_flags();

create or replace function public.platform_messaging_flags()
returns table (
  whatsapp_enabled boolean,
  email_enabled boolean,
  facebook_enabled boolean
)
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
    ) as email_enabled,
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'facebook'),
      false
    ) as facebook_enabled;
$$;

revoke all on function public.platform_messaging_flags() from public;
grant execute on function public.platform_messaging_flags() to authenticated;
