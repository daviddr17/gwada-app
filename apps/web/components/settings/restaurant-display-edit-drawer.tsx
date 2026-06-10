"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Monitor, QrCode, Unlink } from "lucide-react";
import { toast } from "sonner";
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
}: RestaurantDisplayEditDrawerProps) {
  const [name, setName] = useState("");
  const [allowedModules, setAllowedModules] = useState<DisplayModule[]>([]);
  const [autoLockSeconds, setAutoLockSeconds] = useState("60");
  const [isActive, setIsActive] = useState(true);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [confirmUnpairOpen, setConfirmUnpairOpen] = useState(false);
  const [confirmRePairOpen, setConfirmRePairOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open || !display) return;
    setName(display.name);
    setAllowedModules(display.allowed_modules);
    setAutoLockSeconds(String(display.auto_lock_seconds));
    setIsActive(display.is_active);
    setPairing(null);
    setPairingLoading(false);
  }, [open, display]);

  useEffect(() => {
    if (!open) {
      setConfirmUnpairOpen(false);
      setConfirmRePairOpen(false);
      setConfirmDeleteOpen(false);
      setPairing(null);
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

  const runPairing = async () => {
    if (!display || pairingLoading) return;
    setPairingLoading(true);
    setPairing(null);
    try {
      const info = await onStartPairing(display.id);
      if (info) setPairing(info);
    } finally {
      setPairingLoading(false);
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

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
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
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4">
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

              {pairing ? (
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

              <RestaurantDisplayModuleFields
                idPrefix="display-edit"
                allowedModules={allowedModules}
                onChange={setAllowedModules}
              />

              <div className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
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
        confirmDisabled={saving}
        onConfirm={() => {
          setConfirmRePairOpen(false);
          void runPairing();
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
