"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, TabletSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { drawerChromeMaxWidthClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";

type GuestKioskDeviceRow = {
  id: string;
  name: string;
  mollieTerminalId: string | null;
  isActive: boolean;
  isPaired: boolean;
  installationCount?: number;
  lastSeenAt?: string | null;
};

type PairingInfo = {
  code: string;
  expires_at: string;
  device_name?: string;
  pair_url?: string;
};

type Props = {
  restaurantId: string;
};

export function GuestKioskDevicesPanel({ restaurantId }: Props) {
  const [devices, setDevices] = useState<GuestKioskDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [editDevice, setEditDevice] = useState<GuestKioskDeviceRow | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editTerminal, setEditTerminal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
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
        `/api/ordering/kiosk-devices?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const data = (await res.json()) as {
        devices?: GuestKioskDeviceRow[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Kiosk-Geräte konnten nicht geladen werden.");
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

  const startPairing = async (deviceId: string) => {
    try {
      const res = await fetch(
        `/api/ordering/kiosk-devices/${encodeURIComponent(deviceId)}/pairing-code`,
        { method: "POST", credentials: "same-origin" },
      );
      const data = (await res.json()) as PairingInfo & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Kopplungscode fehlgeschlagen.");
        return;
      }
      setPairing(data);
    } catch {
      toast.error("Netzwerkfehler.");
    }
  };

  const createDevice = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name fehlt.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/ordering/kiosk-devices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: trimmed,
          mollieTerminalId: terminalId.trim() || null,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        toast.error(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      toast.success("Kiosk-Gerät angelegt.");
      setCreateOpen(false);
      setName("");
      setTerminalId("");
      await load();
      await startPairing(data.id);
    } finally {
      setCreating(false);
    }
  };

  const unpair = async (deviceId: string) => {
    const res = await fetch(
      `/api/ordering/kiosk-devices/${encodeURIComponent(deviceId)}`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unpair: true }),
      },
    );
    if (!res.ok) {
      toast.error("Entkoppeln fehlgeschlagen.");
      return;
    }
    toast.success("Gerät entkoppelt.");
    await load();
  };

  const removeDevice = async (deviceId: string) => {
    const res = await fetch(
      `/api/ordering/kiosk-devices/${encodeURIComponent(deviceId)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    if (!res.ok) {
      toast.error("Löschen fehlgeschlagen.");
      return;
    }
    toast.success("Gerät gelöscht.");
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const saveEdit = async () => {
    if (!editDevice) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Name fehlt.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/ordering/kiosk-devices/${encodeURIComponent(editDevice.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            mollieTerminalId: editTerminal.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        toast.error("Speichern fehlgeschlagen.");
        return;
      }
      toast.success("Gerät gespeichert.");
      setEditDevice(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="space-y-4 pt-6">
        <div>
          <p className="font-medium">Kiosk-Geräte</p>
          <p className="text-sm text-muted-foreground">
            Feste Counter-/Tisch-Tablets koppeln (wie Display) und optional ein
            Mollie-Terminal zuweisen.
          </p>
        </div>

        {showSkeleton ? (
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className={modulePrimaryAddButtonFullWidthClassName}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Kiosk-Gerät anlegen
            </Button>

            {devices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/50 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Noch keine Kiosk-Geräte. Ohne Gerät gilt die Restaurant-Terminal-ID
                unten als Fallback.
              </p>
            ) : (
              <ul className="space-y-2">
                {devices.map((device) => (
                  <li
                    key={device.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <TabletSmartphone className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{device.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.isPaired ? "Gekoppelt" : "Nicht gekoppelt"}
                          {device.mollieTerminalId
                            ? ` · ${device.mollieTerminalId}`
                            : " · kein Terminal"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditDevice(device);
                          setEditName(device.name);
                          setEditTerminal(device.mollieTerminalId ?? "");
                        }}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className={brandActionButtonRoundedClassName}
                        onClick={() => void startPairing(device.id)}
                      >
                        Koppeln
                      </Button>
                      {device.isPaired ? (
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
          </>
        )}
      </CardContent>

      <Drawer open={createOpen} onOpenChange={setCreateOpen} direction="bottom">
        <DrawerContent className={cn(drawerChromeMaxWidthClassName, "mx-auto")}>
          <DrawerHeader>
            <DrawerTitle>Kiosk-Gerät anlegen</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="kiosk-device-name">Name</Label>
              <Input
                id="kiosk-device-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Counter links"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kiosk-device-terminal">
                Mollie-Terminal (optional)
              </Label>
              <Input
                id="kiosk-device-terminal"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                placeholder="term_…"
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
              className={brandActionButtonRoundedClassName}
              disabled={creating}
              onClick={() => void createDevice()}
            >
              {creating ? "Anlegen …" : "Anlegen & koppeln"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(editDevice)}
        onOpenChange={(open) => {
          if (!open) setEditDevice(null);
        }}
        direction="bottom"
      >
        <DrawerContent className={cn(drawerChromeMaxWidthClassName, "mx-auto")}>
          <DrawerHeader>
            <DrawerTitle>Kiosk-Gerät bearbeiten</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="kiosk-edit-name">Name</Label>
              <Input
                id="kiosk-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kiosk-edit-terminal">Mollie-Terminal</Label>
              <Input
                id="kiosk-edit-terminal"
                value={editTerminal}
                onChange={(e) => setEditTerminal(e.target.value)}
                placeholder="term_…"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDevice(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={brandActionButtonRoundedClassName}
              disabled={savingEdit}
              onClick={() => void saveEdit()}
            >
              {savingEdit ? "Speichern …" : "Speichern"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(pairing)}
        onOpenChange={(open) => {
          if (!open) setPairing(null);
        }}
        direction="bottom"
      >
        <DrawerContent className={cn(drawerChromeMaxWidthClassName, "mx-auto")}>
          <DrawerHeader>
            <DrawerTitle>Gerät koppeln</DrawerTitle>
          </DrawerHeader>
          {pairing ? (
            <div className="space-y-3 px-4 pb-6 text-sm">
              <p className="text-muted-foreground">
                Auf dem Kiosk-Tablet die Kiosk-URL mit Code öffnen (15 Min.
                gültig)
                {pairing.device_name ? ` — ${pairing.device_name}` : ""}.
              </p>
              <p className="rounded-xl border border-border/50 bg-muted/30 px-4 py-6 text-center font-mono text-3xl tracking-[0.35em]">
                {pairing.code}
              </p>
              {pairing.pair_url ? (
                <p className="break-all text-xs text-muted-foreground">
                  {pairing.pair_url}
                </p>
              ) : null}
            </div>
          ) : null}
          <DrawerFooter>
            <Button type="button" onClick={() => setPairing(null)}>
              Fertig
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Card>
  );
}
