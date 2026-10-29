-- Shared inbound mailbox access (allowlist) + personal staff mailboxes.
-- Shared Kontakt mail stays restaurant-scoped (mailbox_owner_user_id null).
-- Personal inbound is private (mailbox_owner_user_id = auth user).

-- Access mode lives in restaurant_integrations.config for key=email:
--   shared_inbox_access: 'all_staff' | 'restricted'
--   shared_inbox_user_ids: uuid[] (auth user / profile ids)

alter table public.contact_messages
  add column if not exists mailbox_owner_user_id uuid
    references auth.users (id) on delete cascade;

comment on column public.contact_messages.mailbox_owner_user_id is
  'null = shared restaurant Kontakt mailbox; set = private staff personal mailbox.';

create index if not exists contact_messages_mailbox_owner_idx
  on public.contact_messages (restaurant_id, mailbox_owner_user_id)
  where mailbox_owner_user_id is not null;

create index if not exists contact_messages_shared_email_idx
  on public.contact_messages (restaurant_id, platform, created_at desc)
  where mailbox_owner_user_id is null;

-- Personal mailbox credentials (one per staff user per restaurant).
create table if not exists public.user_restaurant_email_integrations (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'custom', 'gmail', 'outlook')),
  display_name text,
  connected_at timestamptz,
  last_error text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, user_id)
);

comment on table public.user_restaurant_email_integrations is
  'Personal staff mailbox (Gmail/Outlook/SMTP). Private to user_id; not the shared Kontakt mailbox.';

create index if not exists user_restaurant_email_integrations_user_idx
  on public.user_restaurant_email_integrations (user_id);

alter table public.user_restaurant_email_integrations enable row level security;

drop policy if exists user_restaurant_email_integrations_own
  on public.user_restaurant_email_integrations;
create policy user_restaurant_email_integrations_own
  on public.user_restaurant_email_integrations for all
  to authenticated
  using (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

create or replace function public.trg_user_restaurant_email_integrations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_restaurant_email_integrations_updated_at
  on public.user_restaurant_email_integrations;
create trigger user_restaurant_email_integrations_updated_at
  before update on public.user_restaurant_email_integrations
  for each row execute function public.trg_user_restaurant_email_integrations_set_updated_at();

-- UI helper: redact password from personal mailbox config.
create or replace function public.user_restaurant_email_integration_ui(
  p_restaurant_id uuid
)
returns table (
  restaurant_id uuid,
  user_id uuid,
  status text,
  display_name text,
  connected_at timestamptz,
  last_error text,
  config jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.restaurant_id,
    r.user_id,
    r.status,
    r.display_name,
    r.connected_at,
    r.last_error,
    (
      coalesce(r.config, '{}'::jsonb)
      - 'password'
      - 'refresh_token'
      - 'access_token'
    ) || jsonb_build_object(
      'passwordConfigured',
      case
        when coalesce(r.config->>'password', '') <> '' then true
        when coalesce(r.config->>'refresh_token', '') <> '' then true
        else false
      end,
      'granted_scopes',
      coalesce(r.config->'granted_scopes', '[]'::jsonb)
    ) as config,
    r.updated_at
  from public.user_restaurant_email_integrations r
  where r.restaurant_id = p_restaurant_id
    and r.user_id = auth.uid()
    and public.auth_is_restaurant_staff(p_restaurant_id);
$$;

revoke all on function public.user_restaurant_email_integration_ui(uuid) from public;
grant execute on function public.user_restaurant_email_integration_ui(uuid) to authenticated;

-- Tighten contact_messages visibility: personal rows only for owner.
drop policy if exists "contact_messages_staff_all" on public.contact_messages;
create policy "contact_messages_staff_all"
  on public.contact_messages for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage')
    and (
      mailbox_owner_user_id is null
      or mailbox_owner_user_id = auth.uid()
    )
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage')
    and (
      mailbox_owner_user_id is null
      or mailbox_owner_user_id = auth.uid()
    )
  );
