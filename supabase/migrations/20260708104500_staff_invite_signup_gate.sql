-- Erlaubt geschlossene Beta, aber Registrierung für E-Mails mit offener Staff-Einladung.

create or replace function public.email_has_pending_staff_invite(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_staff_invites i
    inner join public.restaurant_staff s on s.id = i.staff_id
    where i.status = 'pending'
      and i.expires_at > timezone('utc', now())
      and s.email is not null
      and length(trim(s.email)) > 0
      and lower(trim(s.email)) = lower(trim(p_email))
  );
$$;

comment on function public.email_has_pending_staff_invite(text) is
  'True, wenn für die E-Mail eine ausstehende, nicht abgelaufene restaurant_staff_invites-Zeile existiert.';

revoke all on function public.email_has_pending_staff_invite(text) from public;
grant execute on function public.email_has_pending_staff_invite(text) to service_role;
