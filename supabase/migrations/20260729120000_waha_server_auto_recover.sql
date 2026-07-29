-- WAHA: Docker-Container-Name + Auto-Recovery-Metadaten

alter table public.waha_servers
  add column if not exists docker_container_name text;

alter table public.waha_servers
  add column if not exists last_container_restart_at timestamptz;

alter table public.waha_servers
  add column if not exists auto_recover_enabled boolean not null default true;

comment on column public.waha_servers.docker_container_name is
  'Optional: Docker-Container auf dem VPS für „Container neu starten“ (SSH via GitHub Action).';

comment on column public.waha_servers.auto_recover_enabled is
  'Cron waha-session-recover darf Sessions/Container dieses Servers heilen.';
