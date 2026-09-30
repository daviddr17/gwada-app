-- Per-restaurant assistant key (OpenAI or Grok). Service role only.
-- The platform key in platform_integrations.openai stays for the Superadmin assistant.

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.assistant'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create table public.restaurant_assistant_keys (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  provider text not null default 'openai' check (provider in ('openai', 'grok')),
  api_key text,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_assistant_keys_key_nonempty check (
    api_key is null or char_length(trim(api_key)) > 0
  )
);

create trigger restaurant_assistant_keys_set_updated_at
  before update on public.restaurant_assistant_keys
  for each row execute function public.set_updated_at();

alter table public.restaurant_assistant_keys enable row level security;

revoke all on table public.restaurant_assistant_keys from public;
revoke all on table public.restaurant_assistant_keys from anon;
revoke all on table public.restaurant_assistant_keys from authenticated;
grant all on table public.restaurant_assistant_keys to service_role;

comment on table public.restaurant_assistant_keys is
  'Restaurant-eigener Assistenten-Schlüssel. Kein Lesen für Clients.';
