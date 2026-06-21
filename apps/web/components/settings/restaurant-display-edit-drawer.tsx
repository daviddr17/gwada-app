"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Copy, Loader2, Monitor, QrCode, TabletSmartphone, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  DisplayPairSuccessCelebration,
  displayPairSuccessNavigateDelayMs,
} from "@/components/display/display-pair-success-celebration";
import { pairDisplayWithCode } from "@/lib/display/pair-display-client";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestaurantDisplayModuleFields } from "@/components/settings/restaurant-display-module-fields";
import { restaurantPositionDrawerLabelClassName } from "@/components/settings/restaurant-position-color-field";
import {
  DISPLAY_MODULES,
  type DisplayModule,
  type DisplayRow,
} from "@/lib/display/display-types";

type PairingInfo = {
  code: string;
  pair_url: string;
  expires_at: string;
};

export type RestaurantDisplaySavePayload = Partial<
  Pick<DisplayRow, "name" | "allowed_modules" | "auto_lock_seconds" | "is_active">
>;

type RestaurantDisplayEditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  display: DisplayRow | null;
  saving?: boolean;
  onSave: (
    id: string,
    patch: RestaurantDisplaySavePayload,
  ) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onUnpair: (id: string) => Promise<boolean>;
  onStartPairing: (id: string) => Promise<PairingInfo | null>;
  onDevicePaired?: (displayId: string) => void;
};

function modulesEqual(a: DisplayModule[], b: DisplayModule[]) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((m) => setA.has(m));
}

export function RestaurantDisplayEditDrawer({
  open,
  onOpenChange,
  display,
  saving = false,
  onSave,
  onDelete,
  onUnpair,
  onStartPairing,
  onDevicePaired,
}: RestaurantDisplayEditDrawerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [name, setName] = useState("");
  const [allowedModules, setAllowedModules] = useState<DisplayModule[]>([]);
  const [autoLockSeconds, setAutoLockSeconds] = useState("60");
  const [isActive, setIsActive] = useState(true);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [confirmUnpairOpen, setConfirmUnpairOpen] = useState(false);
  const [confirmRePairOpen, setConfirmRePairOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pairDeviceBusy, setPairDeviceBusy] = useState(false);
  const [pairDeviceSuccess, setPairDeviceSuccess] = useState<{
    slug: string;
    restaurantName?: string;
    accentHex?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !display) return;
    setName(display.name);
    setAllowedModules(display.allowed_modules);
    setAutoLockSeconds(String(display.auto_lock_seconds));
    setIsActive(display.is_active);
  }, [
    open,
    display?.id,
    display?.name,
    display?.allowed_modules,
    display?.auto_lock_seconds,
    display?.is_active,
  ]);

  useEffect(() => {
    setPairing(null);
  }, [display?.id]);

  useEffect(() => {
    if (!open) {
      setConfirmUnpairOpen(false);
      setConfirmRePairOpen(false);
      setConfirmDeleteOpen(false);
      setPairing(null);
      setPairingLoading(false);
      setPairDeviceBusy(false);
      setPairDeviceSuccess(null);
    }
  }, [open]);

  const lockValue = Number.parseInt(autoLockSeconds, 10);
  const lockValid = Number.isFinite(lockValue) && lockValue >= 15 && lockValue <= 3600;

  const dirty = useMemo(() => {
    if (!display) return false;
    const trimmed = name.trim();
    return (
      trimmed !== display.name ||
      !lockValid ||
      lockValue !== display.auto_lock_seconds ||
      !modulesEqual(allowedModules, display.allowed_modules) ||
      isActive !== display.is_active
    );
  }, [display, name, lockValid, lockValue, allowedModules, isActive]);

  const moduleSummary = useMemo(() => {
    if (!display) return "";
    const labels = DISPLAY_MODULES.filter((m) =>
      display.allowed_modules.includes(m.id),
    ).map((m) => m.label);
    return labels.length > 0 ? labels.join(", ") : "Keine Module";
  }, [display]);

  const handleSave = async () => {
    if (!display || !dirty || !name.trim() || !lockValid || saving) return;
    const ok = await onSave(display.id, {
      name: name.trim(),
      allowed_modules: allowedModules,
      auto_lock_seconds: lockValue,
      is_active: isActive,
    });
    if (ok) onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!display || saving) return;
    const ok = await onDelete(display.id);
    if (ok) {
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    }
  };

  const handleUnpair = async () => {
    if (!display || saving) return;
    const ok = await onUnpair(display.id);
    if (ok) {
      setConfirmUnpairOpen(false);
      setPairing(null);
    }
  };

  const runPairing = async (): Promise<boolean> => {
    if (!display || pairingLoading) return false;
    setPairingLoading(true);
    setPairing(null);
    try {
      const info = await onStartPairing(display.id);
      if (info) {
        setPairing(info);
        return true;
      }
      return false;
    } finally {
      setPairingLoading(false);
    }
  };

  const anyConfirmOpen =
    confirmUnpairOpen || confirmRePairOpen || confirmDeleteOpen;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopiert.`);
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  };

  const pairCurrentDevice = useCallback(async () => {
    if (!display || !pairing?.code || pairDeviceBusy || pairDeviceSuccess) return;
    setPairDeviceBusy(true);
    try {
      const result = await pairDisplayWithCode(pairing.code);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setPairing(null);
      onDevicePaired?.(display.id);
      setPairDeviceSuccess({
        slug: result.slug,
        restaurantName: result.restaurantName,
        accentHex: result.accentHex,
      });
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setPairDeviceBusy(false);
    }
  }, [display, pairing?.code, pairDeviceBusy, pairDeviceSuccess, onDevicePaired]);

  useEffect(() => {
    if (!pairDeviceSuccess?.slug) return;
    const delayMs = displayPairSuccessNavigateDelayMs(reduceMotion);
    const timer = window.setTimeout(() => {
      window.open(
        `/display/${encodeURIComponent(pairDeviceSuccess.slug)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setPairDeviceSuccess(null);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [pairDeviceSuccess, reduceMotion]);

  return (
    <>
      <DisplayPairSuccessCelebration
        open={Boolean(pairDeviceSuccess)}
        restaurantName={pairDeviceSuccess?.restaurantName}
        accentHex={pairDeviceSuccess?.accentHex}
        className="z-[100]"
      />

      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && anyConfirmOpen) return;
          onOpenChange(nextOpen);
        }}
        dismissible={!anyConfirmOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Monitor className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{display?.name ?? "Display"}</span>
            </DrawerTitle>
            <DrawerDescription className="text-base">
              {display?.is_paired ? "Gekoppelt" : "Nicht gekoppelt"}
              {display ? ` · ${moduleSummary}` : null}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection title="Kopplung">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || pairingLoading || !display}
                  onClick={() => {
                    if (!display) return;
                    if (display.is_paired) setConfirmRePairOpen(true);
                    else void runPairing();
                  }}
                >
                  {pairingLoading ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-1.5 size-4" />
                  )}
                  {display?.is_paired ? "Neu koppeln" : "Koppeln"}
                </Button>
                {display?.is_paired ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || pairingLoading}
                    onClick={() => setConfirmUnpairOpen(true)}
                  >
                    <Unlink className="mr-1.5 size-4" />
                    Entkoppeln
                  </Button>
                ) : null}
              </div>

              {pairingLoading && !pairing ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Kopplungscode wird erzeugt …
                </div>
              ) : null}

              {pairing ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Kopplungscode (15 Min.)</p>
                  <p className="mt-2 font-mono text-3xl tracking-[0.25em]">
                    {pairing.code}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText(pairing.code, "Code")}
                    >
                      <Copy className="mr-1.5 size-4" />
                      Code kopieren
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText(pairing.pair_url, "Link")}
                    >
                      <Copy className="mr-1.5 size-4" />
                      Link kopieren
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pairDeviceBusy || Boolean(pairDeviceSuccess)}
                      onClick={() => void pairCurrentDevice()}
                    >
                      {pairDeviceBusy ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <TabletSmartphone className="mr-1.5 size-4" />
                      )}
                      Aktuelles Gerät hinzufügen
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
              </DrawerFormSection>

              <DrawerFormSection title="Allgemein">
              <div className="space-y-2">
                <Label
                  htmlFor="display-edit-name"
                  className={restaurantPositionDrawerLabelClassName}
                >
                  Name
                </Label>
                <Input
                  id="display-edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="display-edit-lock"
                  className={restaurantPositionDrawerLabelClassName}
                >
                  Auto-Lock (Sekunden)
                </Label>
                <Input
                  id="display-edit-lock"
                  type="number"
                  min={15}
                  max={3600}
                  value={autoLockSeconds}
                  onChange={(e) => setAutoLockSeconds(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              </DrawerFormSection>

              <DrawerFormSection title="Module">
              <RestaurantDisplayModuleFields
                idPrefix="display-edit"
                allowedModules={allowedModules}
                onChange={setAllowedModules}
              />
              </DrawerFormSection>

              <DrawerFormSection title="Status">
              <div className="flex items-center justify-between gap-3">
                <span
                  id="display-edit-active-label"
                  className="flex-1 text-sm font-medium"
                >
                  Display aktiv
                </span>
                <Switch
                  id="display-edit-active"
                  checked={isActive}
                  onCheckedChange={(on) => setIsActive(Boolean(on))}
                  aria-labelledby="display-edit-active-label"
                  className="shrink-0"
                />
              </div>
              </DrawerFormSection>
            </div>

            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="button"
              onSubmit={() => void handleSave()}
              submitLabel="Speichern"
              submitPending={saving}
              submitDisabled={!dirty || !name.trim() || !lockValid}
              showDelete
              onDelete={() => setConfirmDeleteOpen(true)}
              deleteLabel="Display löschen"
              deleteDisabled={saving}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmUnpairOpen}
        onOpenChange={setConfirmUnpairOpen}
        title="Tablet entkoppeln?"
        description="Das Display ist danach am Tablet nicht mehr nutzbar, bis du es erneut koppelst. Die Einstellungen bleiben erhalten."
        confirmLabel="Entkoppeln"
        destructive
        confirmDisabled={saving}
        onConfirm={() => void handleUnpair()}
      />

      <ConfirmDialog
        open={confirmRePairOpen}
        onOpenChange={setConfirmRePairOpen}
        title="Neu koppeln?"
        description="Sobald ein Tablet den neuen Code nutzt, funktionieren bereits gekoppelte Tablets mit diesem Display nicht mehr — sie brauchen dann ebenfalls den neuen Code."
        confirmLabel="Kopplungscode anzeigen"
        confirmDisabled={saving || pairingLoading}
        destructive={false}
        onConfirm={async () => {
          const ok = await runPairing();
          if (!ok) throw new Error("pairing_failed");
        }}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Display wirklich löschen?"
        description={
          display ? (
            <>
              <span className="font-medium text-foreground">{display.name}</span>{" "}
              wird dauerhaft entfernt.
            </>
          ) : null
        }
        confirmLabel="Display löschen"
        destructive
        confirmDisabled={saving}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
