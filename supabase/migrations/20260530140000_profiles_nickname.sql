-- App-wide unique user nickname (profiles).

alter table public.profiles
  add column if not exists nickname text;

comment on column public.profiles.nickname is
  'Optional app-wide unique handle (lowercase, URL-safe).';

alter table public.profiles
  drop constraint if exists profiles_nickname_len;

alter table public.profiles
  add constraint profiles_nickname_len check (
    nickname is null
    or (char_length(nickname) between 2 and 32)
  );

create unique index if not exists profiles_nickname_lower_unique_idx
  on public.profiles (lower(nickname))
  where nickname is not null;
