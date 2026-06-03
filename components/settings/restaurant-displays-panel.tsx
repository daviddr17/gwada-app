"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Monitor, Plus, QrCode, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
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
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pairingFor, setPairingFor] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmUnpairId, setConfirmUnpairId] = useState<string | null>(null);
  const [confirmRePairId, setConfirmRePairId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setDisplays([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/display/displays?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const data = (await res.json()) as { displays?: DisplayRow[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Displays konnten nicht geladen werden.");
        setDisplays([]);
        return;
      }
      setDisplays(data.displays ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDisplay = async () => {
    if (!restaurantId || !newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/display/displays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: newName.trim(),
          allowed_modules: ["time"] as DisplayModule[],
          auto_lock_seconds: 60,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        toast.error(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      setNewName("");
      toast.success("Display angelegt.");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const saveDisplay = async (
    id: string,
    patch: Partial<Pick<DisplayRow, "name" | "allowed_modules" | "auto_lock_seconds" | "is_active">> & {
      unpair?: boolean;
    },
  ) => {
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
        return;
      }
      toast.success(patch.unpair ? "Tablet entkoppelt." : "Gespeichert.");
      if (patch.unpair) {
        setDisplays((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, is_paired: false } : row,
          ),
        );
      }
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const deleteDisplay = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/display/displays/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Löschen fehlgeschlagen.");
        return;
      }
      toast.success("Display gelöscht.");
      if (pairingFor === id) {
        setPairingFor(null);
        setPairing(null);
      }
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const startPairing = async (displayId: string) => {
    setPairingFor(displayId);
    setPairing(null);
    try {
      const res = await fetch(
        `/api/display/displays/${encodeURIComponent(displayId)}/pairing-code`,
        { method: "POST" },
      );
      const data = (await res.json()) as PairingInfo & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Kopplungscode fehlgeschlagen.");
        setPairingFor(null);
        return;
      }
      setPairing(data);
    } catch {
      toast.error("Netzwerkfehler.");
      setPairingFor(null);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopiert.`);
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  };

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (showSkeleton) {
    return (
      <SkeletonCardFrame className="space-y-4">
        <Skeleton className="h-6 w-48 rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
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
    <div className="space-y-6 pb-8">
      <p className="text-sm text-muted-foreground">
        Name, Module und Auto-Lock werden in der Datenbank gespeichert. Am
        Tablet gibt es zusätzlich eine{" "}
        <strong className="font-medium text-foreground">Geräte-ID</strong>{" "}
        (im Browser gespeichert, kein MAC) und einen Cookie — nach Daten löschen
        stellt sich das Tablet die Kopplung oft selbst wieder her. „Entkoppeln“
        beendet alle Tablets; „Neu koppeln“ betrifft nur das Gerät, das den Code
        eingibt.
      </p>

      <ConfirmDialog
        open={confirmUnpairId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmUnpairId(null);
        }}
        title="Tablet entkoppeln?"
        description="Das Display ist danach am Tablet nicht mehr nutzbar, bis du es erneut koppelst. Die Einstellungen (Name, Module) bleiben erhalten."
        confirmLabel="Entkoppeln"
        destructive
        onConfirm={async () => {
          const id = confirmUnpairId;
          if (!id) return;
          setConfirmUnpairId(null);
          await saveDisplay(id, { unpair: true });
        }}
      />

      <ConfirmDialog
        open={confirmRePairId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRePairId(null);
        }}
        title="Neu koppeln?"
        description="Sobald ein Tablet den neuen Code nutzt, funktionieren bereits gekoppelte Tablets mit diesem Display nicht mehr — sie brauchen dann ebenfalls den neuen Code."
        confirmLabel="Kopplungscode anzeigen"
        destructive={false}
        onConfirm={async () => {
          const id = confirmRePairId;
          if (!id) return;
          setConfirmRePairId(null);
          await startPairing(id);
        }}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="new-display-name">Neues Display</Label>
          <Input
            id="new-display-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z. B. Küche, Personalraum, Theke"
          />
        </div>
        <Button
          size="lg"
          className={cn(modulePrimaryAddButtonClassName, "shrink-0")}
          disabled={creating || !newName.trim()}
          onClick={() => void createDisplay()}
        >
          {creating ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Plus className="mr-2 size-4" />
          )}
          Anlegen
        </Button>
      </div>

      {displays.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Displays — lege ein Tablet an und koppel es per QR-Code.
        </p>
      ) : null}

      <div className="grid gap-4">
        {displays.map((d) => {
          const isPairing = pairingFor === d.id;
          const busy = savingId === d.id;
          return (
            <Card key={d.id} className="border-border/50 shadow-card">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      d.is_paired
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {d.is_paired ? "Gekoppelt" : "Nicht gekoppelt"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (d.is_paired) setConfirmRePairId(d.id);
                      else void startPairing(d.id);
                    }}
                  >
                    <QrCode className="mr-1.5 size-4" />
                    {d.is_paired ? "Neu koppeln" : "Koppeln"}
                  </Button>
                  {d.is_paired ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirmUnpairId(d.id)}
                    >
                      <Unlink className="mr-1.5 size-4" />
                      Entkoppeln
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => void deleteDisplay(d.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isPairing && pairing ? (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                    <p className="text-sm font-medium">Kopplungscode (15 Min.)</p>
                    <p className="mt-2 font-mono text-3xl tracking-[0.25em]">
                      {pairing.code}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(pairing.pair_url, "Link")}
                      >
                        <Copy className="mr-1.5 size-4" />
                        Link kopieren
                      </Button>
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {pairing.pair_url}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairing.pair_url)}`}
                      alt="QR-Code zum Koppeln"
                      className="mt-4 rounded-lg border border-border/50 bg-white p-2"
                      width={220}
                      height={220}
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      defaultValue={d.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== d.name) void saveDisplay(d.id, { name: v });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`lock-${d.id}`}>Auto-Lock (Sekunden)</Label>
                    <Input
                      id={`lock-${d.id}`}
                      type="number"
                      min={15}
                      max={3600}
                      defaultValue={d.auto_lock_seconds}
                      onBlur={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n !== d.auto_lock_seconds) {
                          void saveDisplay(d.id, { auto_lock_seconds: n });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Module auf diesem Display</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {DISPLAY_MODULES.filter((m) => m.id !== "kds").map((mod) => {
                      const checked = d.allowed_modules.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 px-3 py-2"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(on) => {
                              const next = on
                                ? [...d.allowed_modules, mod.id]
                                : d.allowed_modules.filter((x) => x !== mod.id);
                              setDisplays((prev) =>
                                prev.map((row) =>
                                  row.id === d.id
                                    ? {
                                        ...row,
                                        allowed_modules: next as DisplayModule[],
                                      }
                                    : row,
                                ),
                              );
                              void saveDisplay(d.id, {
                                allowed_modules: next as DisplayModule[],
                              });
                            }}
                          />
                          <span>
                            <span className="block text-sm font-medium">
                              {mod.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {mod.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={d.is_active}
                    onCheckedChange={(on) =>
                      void saveDisplay(d.id, { is_active: Boolean(on) })
                    }
                  />
                  <span className="text-sm">Display aktiv</span>
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Mitarbeiter-PINs und Rollen-Berechtigungen für Display-Module legst du unter
        Mitarbeiter bzw. Einstellungen → Rollen fest.
      </p>
    </div>
  );
}
