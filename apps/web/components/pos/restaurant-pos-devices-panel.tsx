"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, TabletSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";

type PosDeviceRow = {
  id: string;
  name: string;
  auto_lock_seconds: number;
  is_active: boolean;
  is_paired: boolean;
};

type PairingInfo = {
  code: string;
  expires_at: string;
  device_name?: string;
};

export function RestaurantPosDevicesPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("pos.kasse.manage");

  const [devices, setDevices] = useState<PosDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading || permLoading);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const initialLoadPendingRef = useRef(true);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setDevices([]);
      setLoading(false);
      initialLoadPendingRef.current = false;
      return;
    }
    const isInitialLoad = initialLoadPendingRef.current;
    if (isInitialLoad) setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/devices?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const data = (await res.json()) as {
        devices?: PosDeviceRow[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "POS-Geräte konnten nicht geladen werden.");
        if (isInitialLoad) setDevices([]);
        return;
      }
      setDevices(data.devices ?? []);
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

  const createDevice = async () => {
    if (!restaurantId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name fehlt.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/pos/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name: trimmed }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        toast.error(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      toast.success("POS-Gerät angelegt.");
      setCreateOpen(false);
      setName("");
      await load();
      await startPairing(data.id);
    } finally {
      setCreating(false);
    }
  };

  const startPairing = async (deviceId: string) => {
    try {
      const res = await fetch(
        `/api/pos/devices/${encodeURIComponent(deviceId)}/pairing-code`,
        { method: "POST" },
      );
      const data = (await res.json()) as PairingInfo & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Kopplungscode fehlgeschlagen.");
        return;
      }
      setPairingDeviceId(deviceId);
      setPairing(data);
    } catch {
      toast.error("Netzwerkfehler.");
    }
  };

  const unpair = async (deviceId: string) => {
    const res = await fetch(`/api/pos/devices/${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unpair: true }),
    });
    if (!res.ok) {
      toast.error("Entkoppeln fehlgeschlagen.");
      return;
    }
    toast.success("Gerät entkoppelt.");
    await load();
  };

  const removeDevice = async (deviceId: string) => {
    const res = await fetch(`/api/pos/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Löschen fehlgeschlagen.");
      return;
    }
    toast.success("Gerät gelöscht.");
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
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
        Keine Berechtigung — „Kasse öffnen und schließen“ in den Rollen
        erforderlich, um POS-Geräte zu koppeln.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3 pb-8">
        <p className="text-sm text-muted-foreground">
          Restaurant einmal pro Gerät koppeln. Danach melden sich Mitarbeiter
          nur noch mit ihrer Display-PIN an (Recht „Kasse bedienen“).
        </p>

        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          POS-Gerät anlegen
        </Button>

        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine POS-Geräte. iPad-Kasse und Handhelds hier anlegen und
            koppeln.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/50 bg-card shadow-card">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <TabletSmartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{device.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.is_paired ? "Gekoppelt" : "Nicht gekoppelt"}
                      {" · "}
                      Auto-Sperre {Math.round(device.auto_lock_seconds / 60)}{" "}
                      Min.
                      {!device.is_active ? " · Inaktiv" : null}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void startPairing(device.id)}
                  >
                    Kopplungscode
                  </Button>
                  {device.is_paired ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void unpair(device.id)}
                    >
                      Entkoppeln
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void removeDevice(device.id)}
                  >
                    Löschen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>POS-Gerät anlegen</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-device-name">Name</Label>
              <Input
                id="pos-device-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. iPad Kasse 1"
                maxLength={80}
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={cn(brandActionButtonRoundedClassName)}
              disabled={creating}
              onClick={() => void createDevice()}
            >
              Anlegen
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(pairing)}
        onOpenChange={(open) => {
          if (!open) {
            setPairing(null);
            setPairingDeviceId(null);
            void load();
          }
        }}
      >
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Gerät koppeln</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-6 text-center">
            <p className="text-sm text-muted-foreground">
              Code in der Gwada-POS-App eingeben
              {pairing?.device_name ? ` (${pairing.device_name})` : ""}.
            </p>
            <p className="font-mono text-3xl tracking-[0.35em]">
              {pairing?.code}
            </p>
            <p className="text-xs text-muted-foreground">
              Gültig ca. 15 Minuten
              {pairingDeviceId ? "" : ""}.
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
