-- Öffentliche Warteliste (vor Live-Start); Superadmin-Übersicht.

create table public.platform_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  given_name text not null check (char_length(trim(given_name)) > 0),
  family_name text not null check (char_length(trim(family_name)) > 0),
  email text not null check (char_length(trim(email)) > 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint platform_waitlist_entries_email_unique unique (email),
  constraint platform_waitlist_entries_given_name_len check (char_length(given_name) <= 120),
  constraint platform_waitlist_entries_family_name_len check (char_length(family_name) <= 120),
  constraint platform_waitlist_entries_email_len check (char_length(email) <= 320),
  constraint platform_waitlist_entries_note_len check (note is null or char_length(note) <= 2000)
);

create index platform_waitlist_entries_created_at_idx
  on public.platform_waitlist_entries (created_at desc);

alter table public.platform_waitlist_entries enable row level security;

-- Kein direkter Client-Zugriff — Inserts über Service Role (API), Lesen über Superadmin-RPC.
create policy platform_waitlist_entries_superadmin_select
  on public.platform_waitlist_entries
  for select
  to authenticated
  using (public.auth_is_superadmin());

create or replace function public.superadmin_list_waitlist_entries()
returns table (
  id uuid,
  given_name text,
  family_name text,
  email text,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    w.id,
    w.given_name,
    w.family_name,
    w.email,
    w.note,
    w.created_at
  from public.platform_waitlist_entries w
  order by w.created_at desc;
end;
$$;

revoke all on function public.superadmin_list_waitlist_entries() from public;
grant execute on function public.superadmin_list_waitlist_entries() to authenticated;

-- PostgREST-Schema-Cache aktualisieren (self-hosted).
notify pgrst, 'reload schema';
