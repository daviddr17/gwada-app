"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";
import { SuperadminPaginatedDataTable } from "@/components/superadmin/superadmin-paginated-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  superadminCellNowrapClass,
  superadminDateCellClass,
} from "@/components/superadmin/superadmin-table-cells";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import {
  fetchLiveVpsRebootCooldown,
  triggerLiveVpsReboot,
} from "@/lib/superadmin/live-vps-reboot-api";
import {
  createSuperadminWahaServer,
  deleteSuperadminWahaServer,
  fetchSuperadminWahaServerVersion,
  fetchSuperadminWahaServers,
  fetchSuperadminWahaSessions,
  healthCheckSuperadminWahaServer,
  recoverSuperadminWahaServer,
  restartSuperadminWahaContainer,
  triggerSuperadminWahaHostReboot,
  triggerSuperadminWahaImageUpdate,
  updateSuperadminWahaServer,
  type WahaServerVersionStatus,
} from "@/lib/superadmin/waha-servers-api";
import type {
  WahaServerCapacityAlert,
  WahaServerPublic,
  WahaSessionListItem,
} from "@/lib/waha/waha-server-types";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function capacityLabel(server: WahaServerPublic): string {
  return `${server.session_count}/${server.session_limit}`;
}

type EditorState = {
  id?: string;
  name: string;
  base_url: string;
  api_key: string;
  api_key_configured: boolean;
  enabled: boolean;
  accept_new_sessions: boolean;
  session_limit: string;
  warn_remaining: string;
  sort_order: string;
  notes: string;
  docker_container_name: string;
  ssh_host: string;
  ssh_user: string;
  ssh_port: string;
  ssh_private_key: string;
  ssh_private_key_configured: boolean;
  auto_recover_enabled: boolean;
};

function emptyEditor(): EditorState {
  return {
    name: "",
    base_url: "",
    api_key: "",
    api_key_configured: false,
    enabled: true,
    accept_new_sessions: true,
    session_limit: "200",
    warn_remaining: "10",
    sort_order: "100",
    notes: "",
    docker_container_name: "",
    ssh_host: "",
    ssh_user: "root",
    ssh_port: "22",
    ssh_private_key: "",
    ssh_private_key_configured: false,
    auto_recover_enabled: true,
  };
}

function editorFromServer(s: WahaServerPublic): EditorState {
  return {
    id: s.id,
    name: s.name,
    base_url: s.base_url,
    api_key: "",
    api_key_configured: s.api_key_configured,
    enabled: s.enabled,
    accept_new_sessions: s.accept_new_sessions,
    session_limit: String(s.session_limit),
    warn_remaining: String(s.warn_remaining),
    sort_order: String(s.sort_order),
    notes: s.notes ?? "",
    docker_container_name: s.docker_container_name ?? "",
    ssh_host: s.ssh_host ?? "",
    ssh_user: s.ssh_user || "root",
    ssh_port: String(s.ssh_port || 22),
    ssh_private_key: "",
    ssh_private_key_configured: s.ssh_private_key_configured,
    auto_recover_enabled: s.auto_recover_enabled !== false,
  };
}

function serverHasSsh(s: WahaServerPublic): boolean {
  return Boolean(s.ssh_host?.trim() && s.ssh_private_key_configured);
}

export function SuperadminWahaScreen() {
  const [servers, setServers] = useState<WahaServerPublic[]>([]);
  const [sessions, setSessions] = useState<WahaSessionListItem[]>([]);
  const [alerts, setAlerts] = useState<WahaServerCapacityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverSearch, setServerSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [saving, setSaving] = useState(false);
  const [healthBusyId, setHealthBusyId] = useState<string | null>(null);
  const [recoverBusyId, setRecoverBusyId] = useState<string | null>(null);
  const [restartBusyId, setRestartBusyId] = useState<string | null>(null);
  const [updateBusyId, setUpdateBusyId] = useState<string | null>(null);
  const [versionsById, setVersionsById] = useState<
    Record<string, WahaServerVersionStatus>
  >({});
  const [updateConfirmServer, setUpdateConfirmServer] =
    useState<WahaServerPublic | null>(null);
  const [updateConfirmTyped, setUpdateConfirmTyped] = useState("");
  const [hostRebootBusyId, setHostRebootBusyId] = useState<string | null>(null);
  const [hostRebootServer, setHostRebootServer] =
    useState<WahaServerPublic | null>(null);
  const [hostRebootConfirm, setHostRebootConfirm] = useState("");
  const [vpsRebootOpen, setVpsRebootOpen] = useState(false);
  const [vpsRebootConfirm, setVpsRebootConfirm] = useState("");
  const [vpsRebootBusy, setVpsRebootBusy] = useState(false);
  const [vpsRebootCooldownMs, setVpsRebootCooldownMs] = useState(0);

  const showSkeleton = useDeferredSkeleton(loading);

  const refreshVpsRebootCooldown = useCallback(async () => {
    const res = await fetchLiveVpsRebootCooldown();
    if (!res.error) setVpsRebootCooldownMs(res.cooldownMs);
  }, []);

  const loadVersions = useCallback(async (list: WahaServerPublic[]) => {
    if (list.length === 0) {
      setVersionsById({});
      return;
    }
    const entries = await Promise.all(
      list.map(async (s) => {
        const v = await fetchSuperadminWahaServerVersion(s.id);
        return [s.id, v] as const;
      }),
    );
    setVersionsById(Object.fromEntries(entries));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [serversRes, sessionsRes] = await Promise.all([
      fetchSuperadminWahaServers(),
      fetchSuperadminWahaSessions(),
      refreshVpsRebootCooldown(),
    ]);
    if (serversRes.error) toast.error(serversRes.error);
    if (sessionsRes.error) toast.error(sessionsRes.error);
    setServers(serversRes.servers);
    setAlerts(serversRes.capacityAlerts);
    setSessions(sessionsRes.sessions);
    setLoading(false);
    void loadVersions(serversRes.servers);
  }, [refreshVpsRebootCooldown, loadVersions]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredServers = useMemo(() => {
    const q = serverSearch.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) =>
      [s.name, s.base_url, s.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [servers, serverSearch]);

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      [
        s.restaurant_name,
        s.restaurant_slug,
        s.waha_session_name,
        s.status,
        s.phone_number,
        s.waha_server_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [sessions, sessionSearch]);

  const openCreate = () => {
    setEditor(emptyEditor());
    setEditorOpen(true);
  };

  const openEdit = (s: WahaServerPublic) => {
    setEditor(editorFromServer(s));
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    const sessionLimit = Number(editor.session_limit);
    const warnRemaining = Number(editor.warn_remaining);
    const sortOrder = Number(editor.sort_order);
    if (!editor.name.trim()) {
      toast.error("Name erforderlich.");
      return;
    }
    if (!editor.base_url.trim()) {
      toast.error("Base-URL erforderlich.");
      return;
    }
    if (!editor.id && !editor.api_key.trim()) {
      toast.error("API-Key erforderlich.");
      return;
    }
    if (
      !Number.isFinite(sessionLimit) ||
      sessionLimit < 1 ||
      sessionLimit > 10000
    ) {
      toast.error("Session-Limit ungültig.");
      return;
    }
    if (
      !Number.isFinite(warnRemaining) ||
      warnRemaining < 0 ||
      warnRemaining > 1000
    ) {
      toast.error("Warn-Schwelle ungültig.");
      return;
    }

    setSaving(true);
    const payload = {
      name: editor.name.trim(),
      base_url: editor.base_url.trim(),
      api_key: editor.api_key.trim() || undefined,
      enabled: editor.enabled,
      accept_new_sessions: editor.accept_new_sessions,
      session_limit: sessionLimit,
      warn_remaining: warnRemaining,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
      notes: editor.notes.trim() || null,
      docker_container_name: editor.docker_container_name.trim() || null,
      ssh_host: editor.ssh_host.trim() || null,
      ssh_user: editor.ssh_user.trim() || "root",
      ssh_port: (() => {
        const n = Number.parseInt(editor.ssh_port, 10);
        return Number.isFinite(n) ? n : 22;
      })(),
      ssh_private_key: editor.ssh_private_key.trim() || undefined,
      auto_recover_enabled: editor.auto_recover_enabled,
    };

    const res = editor.id
      ? await updateSuperadminWahaServer(editor.id, payload)
      : await createSuperadminWahaServer(payload);

    setSaving(false);
    if (res.error || !res.server) {
      toast.error(res.error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success(editor.id ? "Server gespeichert." : "Server angelegt.");
    setEditorOpen(false);
    await load();
  };

  const onHealth = async (id: string) => {
    setHealthBusyId(id);
    const res = await healthCheckSuperadminWahaServer(id);
    setHealthBusyId(null);
    if (res.ok) {
      toast.success(
        res.latencyMs != null
          ? `Erreichbar (${res.latencyMs} ms)`
          : "Erreichbar",
      );
    } else {
      toast.error(res.error ?? "Health-Check fehlgeschlagen");
    }
    if (res.server) {
      setServers((prev) =>
        prev.map((s) => (s.id === res.server!.id ? res.server! : s)),
      );
      void loadVersions([res.server]);
    } else {
      await load();
    }
  };

  const onRecoverSessions = async (s: WahaServerPublic) => {
    setRecoverBusyId(s.id);
    const res = await recoverSuperadminWahaServer(s.id);
    setRecoverBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Recovery: ${res.recovered ?? 0} neu gestartet` +
        (res.failed ? `, ${res.failed} Fehler` : "") +
        (res.containerRestarts
          ? `, ${res.containerRestarts} Container-Restart`
          : ""),
    );
    await load();
  };

  const onRestartContainer = async (s: WahaServerPublic) => {
    if (!s.docker_container_name) {
      toast.error(
        "Docker-Container-Name fehlt — unter Bearbeiten eintragen (z. B. waha).",
      );
      return;
    }
    if (!serverHasSsh(s)) {
      toast.error(
        "SSH-Host + Key fehlen — unter Bearbeiten für diesen WAHA-Server setzen.",
      );
      return;
    }
    if (
      !window.confirm(
        `Docker-Container „${s.docker_container_name}“ auf ${s.ssh_host} neu starten? Sessions auf diesem Server kurz offline.`,
      )
    ) {
      return;
    }
    setRestartBusyId(s.id);
    const res = await restartSuperadminWahaContainer(s.id);
    setRestartBusyId(null);
    if (res.error) {
      toast.error(res.message ?? res.error);
      return;
    }
    toast.success(res.message ?? "Container-Neustart gestartet.");
    await load();
  };

  const onConfirmHostReboot = async () => {
    const s = hostRebootServer;
    if (!s) throw new Error("no_server");
    if (hostRebootConfirm.trim() !== "REBOOT") {
      throw new Error("confirm_required");
    }
    setHostRebootBusyId(s.id);
    const res = await triggerSuperadminWahaHostReboot(s.id);
    setHostRebootBusyId(null);
    if (res.error) {
      toast.error(res.message ?? res.error);
      throw new Error(res.error);
    }
    toast.success(
      res.message ??
        `Host-Reboot für ${s.name} gestartet (${s.ssh_host ?? "—"}).`,
    );
    setHostRebootServer(null);
    setHostRebootConfirm("");
  };

  const onConfirmWahaUpdate = async () => {
    const s = updateConfirmServer;
    if (!s) throw new Error("no_server");
    if (updateConfirmTyped.trim() !== "UPDATE") {
      throw new Error("confirm_required");
    }
    setUpdateBusyId(s.id);
    const res = await triggerSuperadminWahaImageUpdate(s.id);
    setUpdateBusyId(null);
    if (res.error) {
      toast.error(res.message ?? res.error);
      throw new Error(res.error);
    }
    toast.success(
      res.message ??
        `Update gestartet${res.targetVersion ? ` → ${res.targetVersion}` : ""}.`,
    );
    setUpdateConfirmServer(null);
    setUpdateConfirmTyped("");
    // Version nach kurzer Wartezeit neu laden (Container kommt hoch)
    window.setTimeout(() => {
      void loadVersions([s]);
    }, 45_000);
  };

  const onConfirmVpsReboot = async () => {
    if (vpsRebootConfirm.trim() !== "REBOOT") {
      throw new Error("confirm_required");
    }
    setVpsRebootBusy(true);
    const res = await triggerLiveVpsReboot({
      confirm: "REBOOT",
      reason: "superadmin-waha",
    });
    setVpsRebootBusy(false);
    if (res.error) {
      toast.error(res.message ?? res.error);
      throw new Error(res.error);
    }
    toast.success(
      res.message ??
        "VPS-Reboot gestartet. Live ist kurz offline (meist 1–3 Minuten).",
    );
    setVpsRebootConfirm("");
    await refreshVpsRebootCooldown();
  };

  const onDelete = async (s: WahaServerPublic) => {
    if (
      !window.confirm(
        `Server „${s.name}“ wirklich löschen? Nur möglich ohne zugewiesene Sessions.`,
      )
    ) {
      return;
    }
    const res = await deleteSuperadminWahaServer(s.id);
    if (res.error) {
      toast.error(res.message ?? res.error);
      return;
    }
    toast.success("Server gelöscht.");
    await load();
  };

  const toggleAccept = async (s: WahaServerPublic, next: boolean) => {
    const res = await updateSuperadminWahaServer(s.id, {
      name: s.name,
      base_url: s.base_url,
      accept_new_sessions: next,
    });
    if (res.error || !res.server) {
      toast.error(res.error ?? "Aktualisieren fehlgeschlagen.");
      return;
    }
    setServers((prev) =>
      prev.map((row) => (row.id === res.server!.id ? res.server! : row)),
    );
  };

  const toggleEnabled = async (s: WahaServerPublic, next: boolean) => {
    const res = await updateSuperadminWahaServer(s.id, {
      name: s.name,
      base_url: s.base_url,
      enabled: next,
    });
    if (res.error || !res.server) {
      toast.error(res.error ?? "Aktualisieren fehlgeschlagen.");
      return;
    }
    setServers((prev) =>
      prev.map((row) => (row.id === res.server!.id ? res.server! : row)),
    );
  };

  if (showSkeleton) {
    return (
      <div className="space-y-6 pt-2" aria-busy>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-2">
      {alerts.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Kapazitätswarnung
              </p>
              {alerts.map((a) => (
                <p key={a.server_id} className="text-muted-foreground">
                  {a.server_name}: {a.session_count}/{a.session_limit} Sessions
                  (Warnung ab {a.session_limit - a.warn_remaining})
                </p>
              ))}
              <p className="text-muted-foreground">
                Neuen WAHA-Server anlegen, bevor keine neuen Sessions mehr
                zugewiesen werden können.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="size-4" />
          <span>
            Pool für NOWEB-Sessions. Pro Server eigener SSH-Host für Update,
            Container und Host-Reboot. Eskalation: Sessions heilen → Container →
            WAHA-Host. „Gwada Live-VPS“ unten ist nur der Contabo-App-Server.
          </span>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Gwada Live-VPS (Contabo)
            </p>
            <p className="text-xs text-muted-foreground">
              Soft-Reboot nur des App-/DB-Hosts — nicht der WAHA-Server. Pro
              WAHA-Host: Button „Host“ in der Zeile.
              {vpsRebootCooldownMs > 0
                ? ` Cooldown noch ca. ${Math.ceil(vpsRebootCooldownMs / 60_000)} Min.`
                : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10"
            disabled={vpsRebootBusy || vpsRebootCooldownMs > 0}
            onClick={() => {
              setVpsRebootConfirm("");
              setVpsRebootOpen(true);
            }}
          >
            {vpsRebootCooldownMs > 0
              ? `VPS-Cooldown (${Math.ceil(vpsRebootCooldownMs / 60_000)} Min.)`
              : "Gwada-VPS neu starten"}
          </Button>
        </div>

        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={openCreate}
        >
          <Plus className="size-4" />
          Server hinzufügen
        </Button>

        <SuperadminSearchToolbar
          search={serverSearch}
          onSearchChange={setServerSearch}
          searchPlaceholder="Server, URL oder Notiz …"
        />

        <SuperadminPaginatedDataTable
          loading={false}
          emptyMessage="Noch kein WAHA-Server. Primär-Server aus Integrationen wird bei Migration übernommen."
          itemLabel="Server"
          resetPageKey={serverSearch}
          rowKey={(r) => r.id}
          columns={[
            {
              id: "name",
              header: "Name",
              className: superadminCellNowrapClass,
              sortValue: (r) => r.name,
              cell: (r) => (
                <button
                  type="button"
                  className="font-medium text-left hover:underline"
                  onClick={() => openEdit(r)}
                >
                  {r.name}
                </button>
              ),
            },
            {
              id: "base_url",
              header: "URL",
              sortValue: (r) => r.base_url,
              cell: (r) => (
                <span className="font-mono text-xs">{r.base_url}</span>
              ),
            },
            {
              id: "capacity",
              header: "Sessions",
              className: superadminCellNowrapClass,
              sortValue: (r) => r.session_count,
              cell: (r) => (
                <span
                  className={cn(
                    r.at_capacity && "text-destructive font-medium",
                    r.near_capacity &&
                      !r.at_capacity &&
                      "text-amber-700 dark:text-amber-300 font-medium",
                  )}
                >
                  {capacityLabel(r)}
                </span>
              ),
            },
            {
              id: "enabled",
              header: "Aktiv",
              className: superadminCellNowrapClass,
              sortValue: (r) => (r.enabled ? 1 : 0),
              cell: (r) => (
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => void toggleEnabled(r, v)}
                  aria-label={`${r.name} aktiv`}
                />
              ),
            },
            {
              id: "accept",
              header: "Neue Sessions",
              className: superadminCellNowrapClass,
              sortValue: (r) => (r.accept_new_sessions ? 1 : 0),
              cell: (r) => (
                <Switch
                  checked={r.accept_new_sessions}
                  onCheckedChange={(v) => void toggleAccept(r, v)}
                  aria-label={`${r.name} neue Sessions`}
                />
              ),
            },
            {
              id: "health",
              header: "Health",
              className: superadminDateCellClass,
              sortValue: (r) => r.last_health_ok_at ?? "",
              cell: (r) =>
                r.last_health_error ? (
                  <span className="text-destructive text-xs">
                    {r.last_health_error}
                  </span>
                ) : (
                  formatDt(r.last_health_ok_at)
                ),
            },
            {
              id: "version",
              header: "Version",
              className: superadminCellNowrapClass,
              sortValue: (r) => versionsById[r.id]?.currentVersion ?? "",
              cell: (r) => {
                const v = versionsById[r.id];
                if (!v) {
                  return (
                    <span className="text-xs text-muted-foreground">…</span>
                  );
                }
                if (!v.currentVersion && v.error) {
                  return (
                    <span className="text-destructive text-xs" title={v.error}>
                      —
                    </span>
                  );
                }
                return (
                  <div className="text-xs leading-snug">
                    <div className="font-mono">
                      {v.currentVersion ?? "—"}
                      {v.engine ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {v.engine}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "text-muted-foreground",
                        v.updateAvailable &&
                          "text-amber-700 dark:text-amber-300 font-medium",
                      )}
                    >
                      {v.latestVersion
                        ? v.updateAvailable
                          ? `Update: ${v.latestVersion}`
                          : `aktuell (= ${v.latestVersion})`
                        : "neueste: —"}
                    </div>
                  </div>
                );
              },
            },
            {
              id: "actions",
              header: "",
              className: superadminCellNowrapClass,
              sortValue: () => "",
              cell: (r) => {
                const v = versionsById[r.id];
                const hasSsh = serverHasSsh(r);
                const updateReady =
                  Boolean(r.docker_container_name) &&
                  hasSsh &&
                  Boolean(v?.updateAvailable);
                return (
                <div className="flex flex-wrap items-center gap-1 justify-end">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={healthBusyId === r.id}
                    onClick={() => void onHealth(r.id)}
                    aria-label="Health-Check"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        healthBusyId === r.id && "animate-spin",
                      )}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={recoverBusyId === r.id}
                    onClick={() => void onRecoverSessions(r)}
                  >
                    {recoverBusyId === r.id ? "…" : "Sessions heilen"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      updateBusyId === r.id ||
                      !r.docker_container_name ||
                      !hasSsh ||
                      !updateReady
                    }
                    title={
                      !hasSsh
                        ? "SSH-Host + Key unter Bearbeiten setzen"
                        : !r.docker_container_name
                          ? "Docker-Container-Name unter Bearbeiten setzen"
                          : !v?.latestVersion
                            ? "Neueste Version unbekannt"
                            : !v.updateAvailable
                              ? "Bereits auf neuester Version"
                              : `Auf ${v.latestVersion} updaten (${r.ssh_host})`
                    }
                    onClick={() => {
                      setUpdateConfirmTyped("");
                      setUpdateConfirmServer(r);
                    }}
                  >
                    {updateBusyId === r.id ? "…" : "Update"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      restartBusyId === r.id ||
                      !r.docker_container_name ||
                      !hasSsh
                    }
                    title={
                      !hasSsh
                        ? "SSH-Host + Key unter Bearbeiten setzen"
                        : r.docker_container_name
                          ? `Container ${r.docker_container_name} auf ${r.ssh_host}`
                          : "Docker-Container-Name unter Bearbeiten setzen"
                    }
                    onClick={() => void onRestartContainer(r)}
                  >
                    {restartBusyId === r.id ? "…" : "Container"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={hostRebootBusyId === r.id || !hasSsh}
                    title={
                      hasSsh
                        ? `WAHA-Host ${r.ssh_host} neu starten`
                        : "SSH-Host + Key unter Bearbeiten setzen"
                    }
                    onClick={() => {
                      setHostRebootConfirm("");
                      setHostRebootServer(r);
                    }}
                  >
                    {hostRebootBusyId === r.id ? "…" : "Host"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(r)}
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void onDelete(r)}
                  >
                    Löschen
                  </Button>
                </div>
                );
              },
            },
          ]}
          rows={filteredServers}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Sessions / Restaurants</h2>
        <SuperadminSearchToolbar
          search={sessionSearch}
          onSearchChange={setSessionSearch}
          searchPlaceholder="Restaurant, Session, Status …"
        />
        <SuperadminPaginatedDataTable
          loading={false}
          emptyMessage="Keine WhatsApp-Sessions vorhanden."
          itemLabel="Sessions"
          resetPageKey={sessionSearch}
          rowKey={(r) => r.restaurant_id}
          columns={[
            {
              id: "restaurant",
              header: "Restaurant",
              sortValue: (r) => r.restaurant_name ?? r.restaurant_id,
              cell: (r) => (
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {r.restaurant_name ?? "—"}
                  </div>
                  {r.restaurant_slug ? (
                    <div className="text-xs text-muted-foreground">
                      {r.restaurant_slug}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              id: "server",
              header: "Server",
              className: superadminCellNowrapClass,
              sortValue: (r) => r.waha_server_name ?? "",
              cell: (r) => r.waha_server_name ?? "—",
            },
            {
              id: "status",
              header: "Status",
              className: superadminCellNowrapClass,
              sortValue: (r) => r.status,
              cell: (r) => r.status,
            },
            {
              id: "phone",
              header: "Nummer",
              className: superadminCellNowrapClass,
              sortValue: (r) => r.phone_number ?? "",
              cell: (r) => r.phone_number ?? "—",
            },
            {
              id: "session",
              header: "Session",
              sortValue: (r) => r.waha_session_name,
              cell: (r) => (
                <span className="font-mono text-xs">{r.waha_session_name}</span>
              ),
            },
            {
              id: "updated",
              header: "Aktualisiert",
              className: superadminDateCellClass,
              sortValue: (r) => r.updated_at,
              cell: (r) => formatDt(r.updated_at),
            },
          ]}
          rows={filteredSessions}
        />
      </section>

      <Drawer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>
              {editor.id ? "WAHA-Server bearbeiten" : "WAHA-Server hinzufügen"}
            </DrawerTitle>
            <DrawerDescription>
              Base-URL inkl. https:// und API-Key. Limit und Warnung sind pro
              Server einstellbar (Default 200 / Warnung 10 vor voll).
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waha-name">Name</Label>
              <Input
                id="waha-name"
                value={editor.name}
                onChange={(e) =>
                  setEditor((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="z. B. WAHA-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waha-url">Base-URL</Label>
              <Input
                id="waha-url"
                value={editor.base_url}
                onChange={(e) =>
                  setEditor((p) => ({ ...p, base_url: e.target.value }))
                }
                placeholder="https://waha.example.com"
                autoComplete="off"
              />
            </div>
            <SecretInput
              label="API-Key"
              value={editor.api_key}
              onChange={(v) => setEditor((p) => ({ ...p, api_key: v }))}
              configured={editor.api_key_configured}
              hint={
                editor.id
                  ? "Leer lassen, um den gespeicherten Key zu behalten."
                  : undefined
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="waha-limit">Session-Limit</Label>
                <Input
                  id="waha-limit"
                  inputMode="numeric"
                  value={editor.session_limit}
                  onChange={(e) =>
                    setEditor((p) => ({ ...p, session_limit: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waha-warn">Warnung (frei)</Label>
                <Input
                  id="waha-warn"
                  inputMode="numeric"
                  value={editor.warn_remaining}
                  onChange={(e) =>
                    setEditor((p) => ({
                      ...p,
                      warn_remaining: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="waha-sort">Sortierung</Label>
              <Input
                id="waha-sort"
                inputMode="numeric"
                value={editor.sort_order}
                onChange={(e) =>
                  setEditor((p) => ({ ...p, sort_order: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waha-notes">Notiz</Label>
              <Input
                id="waha-notes"
                value={editor.notes}
                onChange={(e) =>
                  setEditor((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waha-docker">Docker-Container</Label>
              <Input
                id="waha-docker"
                value={editor.docker_container_name}
                onChange={(e) =>
                  setEditor((p) => ({
                    ...p,
                    docker_container_name: e.target.value,
                  }))
                }
                placeholder="z. B. waha"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Name wie in <span className="font-mono">docker ps</span> auf
                diesem WAHA-Host.
              </p>
            </div>
            <div className="space-y-2 rounded-lg border border-border/50 p-3">
              <p className="text-sm font-medium">SSH dieses WAHA-Servers</p>
              <p className="text-xs text-muted-foreground">
                Eigener Host für Update, Container und Host-Reboot — getrennt
                vom Gwada-Contabo.
              </p>
              <div className="space-y-2 pt-1">
                <Label htmlFor="waha-ssh-host">SSH-Host</Label>
                <Input
                  id="waha-ssh-host"
                  value={editor.ssh_host}
                  onChange={(e) =>
                    setEditor((p) => ({ ...p, ssh_host: e.target.value }))
                  }
                  placeholder="z. B. 109.205.181.63 oder waha.example.com"
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="waha-ssh-user">User</Label>
                  <Input
                    id="waha-ssh-user"
                    value={editor.ssh_user}
                    onChange={(e) =>
                      setEditor((p) => ({ ...p, ssh_user: e.target.value }))
                    }
                    placeholder="root"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waha-ssh-port">Port</Label>
                  <Input
                    id="waha-ssh-port"
                    inputMode="numeric"
                    value={editor.ssh_port}
                    onChange={(e) =>
                      setEditor((p) => ({ ...p, ssh_port: e.target.value }))
                    }
                    placeholder="22"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label
                    htmlFor="waha-ssh-key"
                    className="text-xs text-muted-foreground"
                  >
                    SSH Private Key (PEM)
                  </Label>
                  {editor.ssh_private_key_configured &&
                  !editor.ssh_private_key ? (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Hinterlegt
                    </span>
                  ) : null}
                </div>
                <textarea
                  id="waha-ssh-key"
                  className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={editor.ssh_private_key}
                  onChange={(e) =>
                    setEditor((p) => ({
                      ...p,
                      ssh_private_key: e.target.value,
                    }))
                  }
                  placeholder={
                    editor.ssh_private_key_configured
                      ? "Leer = alten Key behalten — zum Ersetzen PEM oder Base64 hier einfügen (Text muss sichtbar sein)"
                      : "-----BEGIN OPENSSH PRIVATE KEY----- oder Base64-PEM (eine Zeile)"
                  }
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
              <div>
                <Label htmlFor="waha-auto-recover">Auto-Recovery</Label>
                <p className="text-xs text-muted-foreground">
                  Cron heilt fehlgeschlagene/hängende Sessions (alle 5 Min.).
                </p>
              </div>
              <Switch
                id="waha-auto-recover"
                checked={editor.auto_recover_enabled}
                onCheckedChange={(v) =>
                  setEditor((p) => ({ ...p, auto_recover_enabled: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
              <Label htmlFor="waha-enabled">Aktiv</Label>
              <Switch
                id="waha-enabled"
                checked={editor.enabled}
                onCheckedChange={(v) =>
                  setEditor((p) => ({ ...p, enabled: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
              <div>
                <Label htmlFor="waha-accept">Neue Sessions annehmen</Label>
                <p className="text-xs text-muted-foreground">
                  Aus = Drain/Wartung; bestehende Sticky-Zuweisungen bleiben.
                </p>
              </div>
              <Switch
                id="waha-accept"
                checked={editor.accept_new_sessions}
                onCheckedChange={(v) =>
                  setEditor((p) => ({ ...p, accept_new_sessions: v }))
                }
              />
            </div>
          </div>
          <DrawerFooter className="gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className={brandActionButtonRoundedClassName}
              onClick={() => setEditorOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={settingsAccentSaveButtonClassName}
              disabled={saving}
              onClick={() => void saveEditor()}
            >
              Speichern
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={updateConfirmServer != null}
        onOpenChange={(open) => {
          if (!open) {
            setUpdateConfirmServer(null);
            setUpdateConfirmTyped("");
          }
        }}
        title="WAHA wirklich updaten?"
        description={
          <div className="space-y-3 text-sm">
            <p>
              Server{" "}
              <span className="font-medium">
                {updateConfirmServer?.name ?? "—"}
              </span>
              :{" "}
              <span className="font-mono">
                {updateConfirmServer
                  ? (versionsById[updateConfirmServer.id]?.currentVersion ??
                    "—")
                  : "—"}
              </span>
              {" → "}
              <span className="font-mono">
                {updateConfirmServer
                  ? (versionsById[updateConfirmServer.id]?.latestVersion ??
                    "—")
                  : "—"}
              </span>
            </p>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs space-y-1.5 text-foreground">
              <p className="font-medium">Vor dem Update prüfen</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>
                  WhatsApp ist kurz offline (typisch 1–3 Min.), während Image
                  gezogen und Container neu gestartet wird.
                </li>
                <li>
                  Sessions bleiben nur erhalten, wenn Storage persistent ist
                  (Volume auf{" "}
                  <span className="font-mono">.sessions</span> oder
                  Postgres/Mongo) — laut WAHA-Doku. Ohne Persistenz droht neuer
                  QR-Scan.
                </li>
                <li>
                  Compose-Dateien und{" "}
                  <span className="font-mono">.env</span> werden vor dem Edit
                  auf dem WAHA-Host gesichert (
                  <span className="font-mono">.gwada-waha-update-backup-…</span>
                  )
                  {updateConfirmServer?.ssh_host
                    ? ` — ${updateConfirmServer.ssh_host}`
                    : ""}
                  .
                </li>
                <li>
                  Ab 2026.6.1 wird{" "}
                  <span className="font-mono">waha-plus</span> automatisch auf
                  öffentliches <span className="font-mono">waha</span>{" "}
                  umgestellt (Plus = Core).
                </li>
                <li>
                  Nicht mitten im Stoßbetrieb updaten. Gwada selbst (App-DB)
                  bleibt unberührt — nur der WAHA-Container.
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="waha-update-confirm">
                Zur Bestätigung <span className="font-mono">UPDATE</span>{" "}
                eingeben
              </Label>
              <Input
                id="waha-update-confirm"
                value={updateConfirmTyped}
                onChange={(e) => setUpdateConfirmTyped(e.target.value)}
                placeholder="UPDATE"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
          </div>
        }
        confirmLabel={updateBusyId ? "Startet …" : "Update starten"}
        cancelLabel="Abbrechen"
        destructive
        confirmDisabled={
          updateBusyId != null || updateConfirmTyped.trim() !== "UPDATE"
        }
        onConfirm={onConfirmWahaUpdate}
      />

      <ConfirmDialog
        open={hostRebootServer != null}
        onOpenChange={(open) => {
          if (!open) {
            setHostRebootServer(null);
            setHostRebootConfirm("");
          }
        }}
        title="WAHA-Host wirklich neu starten?"
        description={
          <div className="space-y-3">
            <p>
              Soft-Reboot nur von{" "}
              <span className="font-medium">
                {hostRebootServer?.name ?? "—"}
              </span>{" "}
              (
              <span className="font-mono">
                {hostRebootServer?.ssh_host ?? "—"}
              </span>
              ). Gwada-App und andere WAHA-Server bleiben online.
            </p>
            <div className="space-y-2">
              <Label htmlFor="waha-host-reboot-confirm">
                Zur Bestätigung <span className="font-mono">REBOOT</span>{" "}
                eingeben
              </Label>
              <Input
                id="waha-host-reboot-confirm"
                value={hostRebootConfirm}
                onChange={(e) => setHostRebootConfirm(e.target.value)}
                placeholder="REBOOT"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
          </div>
        }
        confirmLabel={hostRebootBusyId ? "Startet …" : "Host neu starten"}
        cancelLabel="Abbrechen"
        destructive
        confirmDisabled={
          hostRebootBusyId != null || hostRebootConfirm.trim() !== "REBOOT"
        }
        onConfirm={onConfirmHostReboot}
      />

      <ConfirmDialog
        open={vpsRebootOpen}
        onOpenChange={(open) => {
          setVpsRebootOpen(open);
          if (!open) setVpsRebootConfirm("");
        }}
        title="Gwada Live-VPS wirklich neu starten?"
        description={
          <div className="space-y-3">
            <p>
              Soft-Reboot des Contabo-App-Hosts (Gwada + DB-Proxy). WAHA-Server
              mit eigenem SSH sind davon nicht betroffen — die rebootest du per
              „Host“ in der Server-Zeile.
            </p>
            <div className="space-y-2">
              <Label htmlFor="vps-reboot-confirm">
                Zur Bestätigung <span className="font-mono">REBOOT</span>{" "}
                eingeben
              </Label>
              <Input
                id="vps-reboot-confirm"
                value={vpsRebootConfirm}
                onChange={(e) => setVpsRebootConfirm(e.target.value)}
                placeholder="REBOOT"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
          </div>
        }
        confirmLabel={vpsRebootBusy ? "Startet …" : "VPS neu starten"}
        cancelLabel="Abbrechen"
        destructive
        confirmDisabled={
          vpsRebootBusy || vpsRebootConfirm.trim() !== "REBOOT"
        }
        onConfirm={onConfirmVpsReboot}
      />
    </div>
  );
}
