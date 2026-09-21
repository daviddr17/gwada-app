-- Display-Modul: enum value profile (must be committed before use in next migration)

do $$ begin
  alter type public.display_module add value if not exists 'profile';
exception
  when duplicate_object then null;
end $$;
