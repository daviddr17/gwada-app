-- Pro WAHA-Server eigener SSH-Host (Update / Container / Host-Reboot).
-- Secrets nur via Service-Role; UI sieht nur ssh_*_configured-Flags.

alter table public.waha_servers
  add column if not exists ssh_host text;

alter table public.waha_servers
  add column if not exists ssh_user text not null default 'root';

alter table public.waha_servers
  add column if not exists ssh_port integer not null default 22;

alter table public.waha_servers
  add column if not exists ssh_private_key text not null default '';

comment on column public.waha_servers.ssh_host is
  'SSH-Host dieses WAHA-Servers (IP/Hostname). Leer = Fallback LIVE_VPS_HOST (Gwada-Contabo).';

comment on column public.waha_servers.ssh_user is
  'SSH-User für Container-/Image-Ops und Host-Reboot.';

comment on column public.waha_servers.ssh_port is
  'SSH-Port (Standard 22).';

comment on column public.waha_servers.ssh_private_key is
  'Privater SSH-Key (PEM) nur für diesen WAHA-Host — nie an Clients ausliefern.';

alter table public.waha_servers
  drop constraint if exists waha_servers_ssh_port_range;

alter table public.waha_servers
  add constraint waha_servers_ssh_port_range
  check (ssh_port >= 1 and ssh_port <= 65535);
