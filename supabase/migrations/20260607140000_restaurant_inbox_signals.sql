-- Leichte Realtime-Signale für Inbox-Updates (z. B. WAHA-Webhook ohne verknüpften Kontakt).

create table public.restaurant_inbox_signals (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  source text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_inbox_signals_source_check check (
    source in ('waha', 'email')
  )
);

create index restaurant_inbox_signals_restaurant_created_idx
  on public.restaurant_inbox_signals (restaurant_id, created_at desc);

alter table public.restaurant_inbox_signals enable row level security;

create policy "restaurant_inbox_signals_staff_select"
  on public.restaurant_inbox_signals for select
  using (public.auth_is_restaurant_staff(restaurant_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.restaurant_inbox_signals;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;