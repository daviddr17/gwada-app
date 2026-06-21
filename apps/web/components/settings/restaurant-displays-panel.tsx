"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Monitor, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  RestaurantDisplayCreateDrawer,
  type RestaurantDisplayCreatePayload,
} from "@/components/settings/restaurant-display-create-drawer";
import {
  RestaurantDisplayEditDrawer,
  type RestaurantDisplaySavePayload,
} from "@/components/settings/restaurant-display-edit-drawer";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  DISPLAY_MODULES,
  type DisplayModule,
  type DisplayRow,
} from "@/lib/display/display-types";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";

type PairingInfo = {
  code: string;
  pair_url: string;
  expires_at: string;
};

export function RestaurantDisplaysPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("display.manage");

  const [displays, setDisplays] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading || permLoading);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const initialLoadPendingRef = useRef(true);

  const editingDisplay = useMemo(
    () => displays.find((d) => d.id === editingId) ?? null,
    [displays, editingId],
  );

  const load = useCallback(async () => {
    if (!restaurantId) {
      setDisplays([]);
      setLoading(false);
      initialLoadPendingRef.current = false;
      return;
    }
    const isInitialLoad = initialLoadPendingRef.current;
    if (isInitialLoad) setLoading(true);
    try {
      const res = await fetch(
        `/api/display/displays?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const data = (await res.json()) as { displays?: DisplayRow[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Displays konnten nicht geladen werden.");
        if (isInitialLoad) setDisplays([]);
        return;
      }
      setDisplays(data.displays ?? []);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
        initialLoadPendingRef.current = false;
      }
    }
  }, [restaurantId]);

  useEffect(() => {
    initialLoadPendingRef.current = true;
    setLoading(true);
    void load();
  }, [load]);

  const applyDisplayPatch = useCallback(
    (id: string, patch: Partial<DisplayRow>) => {
      setDisplays((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const openEdit = (display: DisplayRow) => {
    setEditingId(display.id);
    setEditOpen(true);
  };

  const createDisplay = async (payload: RestaurantDisplayCreatePayload) => {
    if (!restaurantId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/display/displays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: payload.name,
          allowed_modules: payload.allowed_modules,
          auto_lock_seconds: payload.auto_lock_seconds,
          is_active: payload.is_active,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        toast.error(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      toast.success("Display angelegt.");
      setCreateOpen(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const saveDisplay = async (
    id: string,
    patch: RestaurantDisplaySavePayload & { unpair?: boolean },
  ): Promise<boolean> => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/display/displays/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          data.error?.includes("invalid input value for enum")
            ? "Module konnten nicht gespeichert werden (Datenbank-Migration fehlt evtl. auf Live)."
            : "Speichern fehlgeschlagen.",
        );
        await load();
        return false;
      }
      toast.success(patch.unpair ? "Tablet entkoppelt." : "Gespeichert.");
      const localPatch: Partial<DisplayRow> = {};
      if (patch.unpair) localPatch.is_paired = false;
      if (patch.name !== undefined) localPatch.name = patch.name.trim();
      if (patch.allowed_modules !== undefined) {
        localPatch.allowed_modules = patch.allowed_modules;
      }
      if (patch.auto_lock_seconds !== undefined) {
        localPatch.auto_lock_seconds = patch.auto_lock_seconds;
      }
      if (patch.is_active !== undefined) localPatch.is_active = patch.is_active;
      applyDisplayPatch(id, localPatch);
      return true;
    } finally {
      setSavingId(null);
    }
  };

  const deleteDisplay = async (id: string): Promise<boolean> => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/display/displays/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Löschen fehlgeschlagen.");
        return false;
      }
      toast.success("Display gelöscht.");
      setDisplays((prev) => prev.filter((row) => row.id !== id));
      return true;
    } finally {
      setSavingId(null);
    }
  };

  const startPairing = async (displayId: string): Promise<PairingInfo | null> => {
    try {
      const res = await fetch(
        `/api/display/displays/${encodeURIComponent(displayId)}/pairing-code`,
        { method: "POST" },
      );
      const data = (await res.json()) as PairingInfo & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Kopplungscode fehlgeschlagen.");
        return null;
      }
      return data;
    } catch {
      toast.error("Netzwerkfehler.");
      return null;
    }
  };

  const moduleSummary = (modules: DisplayModule[]) => {
    const labels = DISPLAY_MODULES.filter((m) => modules.includes(m.id)).map(
      (m) => m.label,
    );
    return labels.length > 0 ? labels.join(", ") : "Keine Module";
  };

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (showSkeleton) {
    return (
      <SkeletonCardFrame className="space-y-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </SkeletonCardFrame>
    );
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Berechtigung — „Displays verwalten“ in den Rollen erforderlich.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3 pb-8">
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          Display anlegen
        </Button>

        {displays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Displays — lege ein Tablet an und koppel es per QR-Code.
          </p>
        ) : (
          <ul className="space-y-1">
            {displays.map((d) => {
              const isActive = editOpen && editingId === d.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-border/50 px-3 py-3 text-left text-sm shadow-card transition-colors",
                      isActive
                        ? "border-accent/40 bg-accent/5"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <Monitor className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">
                        {d.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {moduleSummary(d.allowed_modules)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        d.is_paired
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {d.is_paired ? "Gekoppelt" : "Nicht gekoppelt"}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Mitarbeiter-PINs und Rollen-Berechtigungen für Display-Module legst du
          unter Mitarbeiter bzw. Einstellungen → Rollen fest.
        </p>
      </div>

      <RestaurantDisplayCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        pending={creating}
        onCreate={(payload) => void createDisplay(payload)}
      />

      <RestaurantDisplayEditDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingId(null);
        }}
        display={editingDisplay}
        saving={editingId !== null && savingId === editingId}
        onSave={saveDisplay}
        onDelete={deleteDisplay}
        onUnpair={(id) => saveDisplay(id, { unpair: true })}
        onStartPairing={startPairing}
        onDevicePaired={(id) => applyDisplayPatch(id, { is_paired: true })}
      />
    </>
  );
}
