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
  createSuperadminWahaServer,
  deleteSuperadminWahaServer,
  fetchSuperadminWahaServers,
  fetchSuperadminWahaSessions,
  healthCheckSuperadminWahaServer,
  updateSuperadminWahaServer,
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
  };
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

  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    const [serversRes, sessionsRes] = await Promise.all([
      fetchSuperadminWahaServers(),
      fetchSuperadminWahaSessions(),
    ]);
    if (serversRes.error) toast.error(serversRes.error);
    if (sessionsRes.error) toast.error(sessionsRes.error);
    setServers(serversRes.servers);
    setAlerts(serversRes.capacityAlerts);
    setSessions(sessionsRes.sessions);
    setLoading(false);
  }, []);

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
    } else {
      await load();
    }
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
            Pool für NOWEB-Sessions. Sticky pro Restaurant — neue Sessions auf
            den Server mit der meisten Luft.
          </span>
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
              id: "actions",
              header: "",
              className: superadminCellNowrapClass,
              sortValue: () => "",
              cell: (r) => (
                <div className="flex items-center gap-1 justify-end">
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
              ),
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
    </div>
  );
}
