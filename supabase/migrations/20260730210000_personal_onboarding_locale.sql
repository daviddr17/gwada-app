-- Personal onboarding after invite/signup + fix legacy French locale default

alter table public.profiles
  add column if not exists personal_onboarding_completed_at timestamptz;

comment on column public.profiles.personal_onboarding_completed_at is
  'Set when the user finishes the personal profile onboarding wizard (language + names + phone).';

-- Legacy column default was fr-GP (Guadeloupe product history) — not a conscious UI choice.
update public.profiles
set locale = 'de-DE'
where locale is null
   or locale in ('fr-GP', 'fr', 'FR', 'fr_GP');

alter table public.profiles
  alter column locale set default 'de-DE';

-- Existing users who already have names skip the new wizard.
update public.profiles
set personal_onboarding_completed_at = coalesce(updated_at, created_at, now())
where personal_onboarding_completed_at is null
  and nullif(trim(given_name), '') is not null
  and nullif(trim(family_name), '') is not null;

-- New auth users: always seed German product locale (user picks another language in onboarding).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_given text;
  v_family text;
  v_display text;
begin
  v_given := nullif(trim(coalesce(new.raw_user_meta_data ->> 'given_name', '')), '');
  v_family := nullif(trim(coalesce(new.raw_user_meta_data ->> 'family_name', '')), '');
  v_display := nullif(trim(concat_ws(' ', v_given, v_family)), '');

  if v_display is null then
    v_display := coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    );
  end if;

  insert into public.profiles (
    id,
    display_name,
    given_name,
    family_name,
    locale
  )
  values (
    new.id,
    v_display,
    v_given,
    v_family,
    'de-DE'
  );

  return new;
end;
$$;
