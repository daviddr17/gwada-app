-- Autopilot: saved Vorlagen + Restaurant-KI Usage-Log (dein Verbrauch)

alter table public.social_post_suggestions
  drop constraint if exists social_post_suggestions_status_check;

alter table public.social_post_suggestions
  add constraint social_post_suggestions_status_check
  check (
    status in (
      'pending',
      'approved',
      'skipped',
      'expired',
      'needs_asset',
      'saved'
    )
  );

create index if not exists social_post_suggestions_restaurant_saved_idx
  on public.social_post_suggestions (restaurant_id, updated_at desc)
  where status = 'saved';

create table if not exists public.restaurant_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  source text not null
    check (source in ('autopilot', 'assistant', 'brand_learn')),
  provider text not null default '',
  model text not null default '',
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  meta jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meta) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists restaurant_ai_usage_events_restaurant_created_idx
  on public.restaurant_ai_usage_events (restaurant_id, created_at desc);

alter table public.restaurant_ai_usage_events enable row level security;

create policy restaurant_ai_usage_events_staff_select
  on public.restaurant_ai_usage_events for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

-- Writes nur Service-Role / Admin-Client (kein Staff-Insert-Policy).
