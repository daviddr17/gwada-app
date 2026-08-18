"use client";

import { useState } from "react";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_ACCOUNTING_TAX_RATES } from "@/lib/accounting/default-catalog";
import {
  EVENT_PACKAGE_KIND_LABELS,
  EVENT_PACKAGE_KINDS,
  isEventPackageKind,
  parseEventPackageMoney,
  type EventPackage,
  type EventPackageKind,
  type EventPackageWriteFields,
} from "@/lib/events/event-package";
import { toast } from "sonner";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerFormHeaderClassName, drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";

const KIND_OPTIONS = EVENT_PACKAGE_KINDS.map((kind) => ({
  value: kind,
  label: EVENT_PACKAGE_KIND_LABELS[kind],
}));

const TAX_OPTIONS = DEFAULT_ACCOUNTING_TAX_RATES.map((rate) => ({
  value: String(rate.rate_percent),
  label: rate.label,
}));

export function EventPackageDrawer({
  open,
  onOpenChange,
  pending = false,
  pkg,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  pkg: EventPackage | null;
  onSave: (input: EventPackageWriteFields) => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState<EventPackageKind>("buffet");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [taxRate, setTaxRate] = useState("19");
  const [active, setActive] = useState(true);

  useDrawerFormSeed(open, pkg?.id ?? "__create__", () => {
    setKind(pkg?.kind ?? "buffet");
    setName(pkg?.name ?? "");
    setDescription(pkg?.description ?? "");
    setPrice(pkg ? String(pkg.pricePerPerson).replace(".", ",") : "");
    setTaxRate(String(pkg?.taxRatePercent ?? 19).replace(/\.0+$/, ""));
    setActive(pkg?.active ?? true);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    const pricePerPerson = parseEventPackageMoney(price);
    if (pricePerPerson < 0 || pricePerPerson > 9999.99) {
      toast.error("Bitte einen gültigen Preis pro Person eingeben.");
      return;
    }
    onSave({
      kind,
      name: trimmed,
      description: description.trim(),
      pricePerPerson,
      taxRatePercent: parseEventPackageMoney(taxRate),
      active,
      sortOrder: pkg?.sortOrder ?? 0,
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {pkg ? "Paket bearbeiten" : "Neues Paket"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Preis pro Person für Buffet, Getränke oder Extras — erscheint im Anfrageformular.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Paket">
              <div className="space-y-2">
                <Label htmlFor="event-package-kind">Art</Label>
                <SearchableSelect
                  id="event-package-kind"
                  value={kind}
                  onValueChange={(value) => {
                    if (isEventPackageKind(value)) setKind(value);
                  }}
                  options={KIND_OPTIONS}
                  className="min-h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-package-name">Name</Label>
                <Input
                  id="event-package-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Buffet Classic"
                  maxLength={120}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-package-description">Beschreibung</Label>
                <Textarea
                  id="event-package-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Kurz, was enthalten ist"
                  className="min-h-[4.5rem] resize-y rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-package-price">Preis / Person</Label>
                  <Input
                    id="event-package-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="29,90"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-package-tax">MwSt.</Label>
                  <SearchableSelect
                    id="event-package-tax"
                    value={taxRate}
                    onValueChange={(value) => {
                      if (value) setTaxRate(value);
                    }}
                    options={TAX_OPTIONS}
                    className="min-h-12 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="event-package-active">Im Formular anzeigen</Label>
                <Switch
                  id="event-package-active"
                  checked={active}
                  onCheckedChange={(checked) => setActive(checked === true)}
                />
              </div>
            </DrawerFormSection>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitPending={pending}
            submitDisabled={!name.trim()}
            showDelete={Boolean(pkg && onDelete)}
            onDelete={onDelete}
            deleteLabel="Löschen"
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
