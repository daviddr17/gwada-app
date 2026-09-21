"use client";

import { useMemo, useState } from "react";
import { SearchableMultiSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  DrawerFormBody,
  DrawerFormScrollArea,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isLineDeliveryResolved } from "@/lib/inventory/purchase-order-line-delivery";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import type { PurchaseOrder, PurchaseOrderLine } from "@/lib/types/purchase-order";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

export type PurchaseOrderCloseDeliveryException = {
  lineId: string;
  status: "not_delivered" | "partial";
  deliveredQuantity?: number;
};

type PurchaseOrderCloseDeliveryDrawerProps = {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitLabelForLine: (line: PurchaseOrderLine) => string;
  onConfirm: (
    exceptions: PurchaseOrderCloseDeliveryException[],
    options: { skipStock: boolean },
  ) => void | Promise<void>;
};

export function PurchaseOrderCloseDeliveryDrawer({
  order,
  open,
  onOpenChange,
  unitLabelForLine,
  onConfirm,
}: PurchaseOrderCloseDeliveryDrawerProps) {
  const [notDeliveredIds, setNotDeliveredIds] = useState<string[]>([]);
  const [partialIds, setPartialIds] = useState<string[]>([]);
  const [partialQtyById, setPartialQtyById] = useState<Record<string, string>>(
    {},
  );
  const [pending, setPending] = useState(false);
  const [skipStock, setSkipStock] = useState(false);

  const unresolvedLines = useMemo(
    () => (order ? order.lines.filter((l) => !isLineDeliveryResolved(l)) : []),
    [order],
  );

  const lineOptions = useMemo(
    () =>
      unresolvedLines.map((l) => ({
        value: l.id,
        label: `${l.ingredientName} (${l.quantity} ${unitLabelForLine(l)})`,
      })),
    [unresolvedLines, unitLabelForLine],
  );

  useDrawerFormSeed(open, order?.id ?? "", () => {
    setNotDeliveredIds([]);
    setPartialIds([]);
    setPartialQtyById({});
    setSkipStock(false);
    setPending(false);
  });

  const deliveredCount = Math.max(
    0,
    unresolvedLines.length - notDeliveredIds.length - partialIds.length,
  );

  const partialLines = useMemo(
    () => unresolvedLines.filter((l) => partialIds.includes(l.id)),
    [partialIds, unresolvedLines],
  );

  const partialValid = partialLines.every((l) => {
    const raw = partialQtyById[l.id]?.trim() ?? "";
    if (raw === "") return false;
    const q = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(q) && q >= 0;
  });

  const canSubmit =
    !pending &&
    unresolvedLines.length > 0 &&
    (partialIds.length === 0 || partialValid);

  const setNotDelivered = (ids: string[]) => {
    setNotDeliveredIds(ids);
    setPartialIds((prev) => prev.filter((id) => !ids.includes(id)));
    setPartialQtyById((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  };

  const setPartial = (ids: string[]) => {
    setPartialIds(ids);
    setNotDeliveredIds((prev) => prev.filter((id) => !ids.includes(id)));
    setPartialQtyById((prev) => {
      const next: Record<string, string> = {};
      for (const id of ids) {
        next[id] = prev[id] ?? "";
      }
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit || !order) return;
    setPending(true);
    try {
      const exceptions: PurchaseOrderCloseDeliveryException[] = [
        ...notDeliveredIds.map((lineId) => ({
          lineId,
          status: "not_delivered" as const,
        })),
        ...partialIds.map((lineId) => ({
          lineId,
          status: "partial" as const,
          deliveredQuantity: Number.parseFloat(
            (partialQtyById[lineId] ?? "0").replace(",", "."),
          ),
        })),
      ];
      await onConfirm(exceptions, { skipStock });
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
      dismissible={!pending}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("formMd")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Lieferung abschließen
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Offene Positionen werden als geliefert gebucht. Nur Ausnahmen unten
            wählen.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          <DrawerFormScrollArea contentPadding={6}>
            <DrawerFormSection>
              <p className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-foreground">
                {unresolvedLines.length === 0 ? (
                  "Keine offenen Positionen."
                ) : (
                  <>
                    <span className="font-medium tabular-nums">
                      {deliveredCount}
                    </span>
                    {" von "}
                    <span className="font-medium tabular-nums">
                      {unresolvedLines.length}
                    </span>
                    {" offen → geliefert"}
                    {notDeliveredIds.length > 0 || partialIds.length > 0
                      ? ` · ${notDeliveredIds.length + partialIds.length} Ausnahme${
                          notDeliveredIds.length + partialIds.length === 1
                            ? ""
                            : "n"
                        }`
                      : ""}
                  </>
                )}
              </p>
            </DrawerFormSection>

            <DrawerFormSection title="Ausnahmen">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Nicht geliefert
                  </Label>
                  <SearchableMultiSelect
                    options={lineOptions}
                    value={notDeliveredIds}
                    onChange={setNotDelivered}
                    disabled={pending || unresolvedLines.length === 0}
                    placeholder="Positionen wählen …"
                    searchPlaceholder="Position suchen …"
                    emptyMessage="Keine offenen Positionen."
                    aria-label="Nicht gelieferte Positionen"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Abweichend
                  </Label>
                  <SearchableMultiSelect
                    options={lineOptions}
                    value={partialIds}
                    onChange={setPartial}
                    disabled={pending || unresolvedLines.length === 0}
                    placeholder="Positionen wählen …"
                    searchPlaceholder="Position suchen …"
                    emptyMessage="Keine offenen Positionen."
                    aria-label="Abweichend gelieferte Positionen"
                  />
                </div>

                {partialLines.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Gelieferte Menge angeben
                    </p>
                    {partialLines.map((line) => (
                      <label
                        key={line.id}
                        className="flex items-center gap-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {line.ingredientName}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={pending}
                          value={partialQtyById[line.id] ?? ""}
                          onChange={(e) =>
                            setPartialQtyById((prev) => ({
                              ...prev,
                              [line.id]: e.target.value,
                            }))
                          }
                          placeholder={String(line.quantity)}
                          className={cn(
                            "h-9 w-[5.5rem] shrink-0 rounded-xl border border-input bg-background px-2 text-right text-sm tabular-nums outline-none",
                            "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
                          )}
                          aria-label={`Gelieferte Menge ${line.ingredientName}`}
                        />
                        <span className="w-10 shrink-0 text-xs text-muted-foreground">
                          {unitLabelForLine(line)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Bestand">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="po-close-skip-stock">
                    Bestand nicht anpassen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aktuellen Lagerbestand belassen — z. B. wenn du die Lieferung
                    schon gezählt hast und die Bestellung nur nachträglich
                    abhakst.
                  </p>
                </div>
                <Switch
                  id="po-close-skip-stock"
                  checked={skipStock}
                  disabled={pending}
                  onCheckedChange={(checked) => setSkipStock(checked === true)}
                />
              </div>
            </DrawerFormSection>
          </DrawerFormScrollArea>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            cancelDisabled={pending}
            submitType="button"
            submitLabel="Abschließen"
            submitPending={pending}
            submitDisabled={!canSubmit}
            onSubmit={() => void submit()}
          />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
