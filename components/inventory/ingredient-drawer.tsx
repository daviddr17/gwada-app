"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Switch } from "@/components/ui/switch";
import type {
  IngredientStockUnit,
  InventoryTaxonomyDefinition,
  NewIngredient,
} from "@/lib/types/inventory";
import { cn } from "@/lib/utils";

type IngredientDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (row: NewIngredient) => boolean | Promise<boolean>;
  suppliers: InventoryTaxonomyDefinition[];
  ingredientCategories: InventoryTaxonomyDefinition[];
  productionSites: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
};

function firstActiveId(list: InventoryTaxonomyDefinition[]): string {
  const x = list.find((i) => i.active !== false);
  return x?.id ?? list[0]?.id ?? "";
}

export function IngredientDrawer({
  open,
  onOpenChange,
  onCreate,
  suppliers,
  ingredientCategories,
  productionSites,
  brands,
  units,
}: IngredientDrawerProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<IngredientStockUnit>("g");
  const [currentStock, setCurrentStock] = useState("0");
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productionSiteId, setProductionSiteId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setName("");
      setUnit(firstActiveId(units) || "g");
      setCurrentStock("0");
      setSupplierId(firstActiveId(suppliers));
      setCategoryId(firstActiveId(ingredientCategories));
      setProductionSiteId(firstActiveId(productionSites));
      setBrandId(firstActiveId(brands));
      setActive(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, suppliers, ingredientCategories, productionSites, brands, units]);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: `${s.name}${s.active === false ? " (inaktiv)" : ""}`,
      })),
    [suppliers],
  );
  const categoryOptions = useMemo(
    () =>
      ingredientCategories.map((s) => ({
        value: s.id,
        label: `${s.name}${s.active === false ? " (inaktiv)" : ""}`,
      })),
    [ingredientCategories],
  );
  const productionOptions = useMemo(
    () =>
      productionSites.map((s) => ({
        value: s.id,
        label: `${s.name}${s.active === false ? " (inaktiv)" : ""}`,
      })),
    [productionSites],
  );
  const brandOptions = useMemo(
    () =>
      brands.map((s) => ({
        value: s.id,
        label: `${s.name}${s.active === false ? " (inaktiv)" : ""}`,
      })),
    [brands],
  );

  const unitSelectItems = useMemo(
    () =>
      Object.fromEntries(
        units.map((u) => [
          u.id,
          `${u.name}${u.active === false ? " · inaktiv" : ""}`,
        ]),
      ),
    [units],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const stock = Number.parseFloat(currentStock.replace(",", "."));
    if (Number.isNaN(stock) || stock < 0) return;
    void (async () => {
      const ok = await Promise.resolve(
        onCreate({
          name: trimmed,
          unit,
          currentStock: stock,
          supplierId: supplierId || firstActiveId(suppliers),
          categoryId: categoryId || firstActiveId(ingredientCategories),
          productionSiteId: productionSiteId || firstActiveId(productionSites),
          brandId: brandId || firstActiveId(brands),
          active,
        }),
      );
      if (ok) onOpenChange(false);
    })();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Neue Zutat
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Bestand und Zuordnungen – später mit Lagerbuchung verknüpfbar.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 pb-4">
          <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="ing-name">Name</Label>
              <Input
                id="ing-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. schwarzer Pfeffer"
                className="h-12 rounded-xl"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ing-unit">Einheit</Label>
                <Select
                  value={unit}
                  items={unitSelectItems}
                  onValueChange={(v) => {
                    if (typeof v === "string") setUnit(v);
                  }}
                >
                  <SelectTrigger id="ing-unit" className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.active === false ? " · inaktiv" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ing-stock">Aktueller Bestand</Label>
                <Input
                  id="ing-stock"
                  inputMode="decimal"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-supplier">Lieferant</Label>
              <SearchableSelect
                id="ing-supplier"
                options={supplierOptions}
                value={supplierId || null}
                onValueChange={setSupplierId}
                placeholder="Lieferant wählen"
                searchPlaceholder="Lieferant suchen…"
                aria-label="Lieferant"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-cat">Kategorie</Label>
              <SearchableSelect
                id="ing-cat"
                options={categoryOptions}
                value={categoryId || null}
                onValueChange={setCategoryId}
                placeholder="Kategorie wählen"
                searchPlaceholder="Kategorie suchen…"
                aria-label="Zutaten-Kategorie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-prod">Produktionsstelle</Label>
              <SearchableSelect
                id="ing-prod"
                options={productionOptions}
                value={productionSiteId || null}
                onValueChange={setProductionSiteId}
                placeholder="Produktionsstelle wählen"
                searchPlaceholder="Stelle suchen…"
                aria-label="Produktionsstelle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-brand">Marke</Label>
              <SearchableSelect
                id="ing-brand"
                options={brandOptions}
                value={brandId || null}
                onValueChange={setBrandId}
                placeholder="Marke wählen"
                searchPlaceholder="Marke suchen…"
                aria-label="Marke"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="ing-active" className="text-sm font-medium">
                  Aktiv
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inaktive Zutaten können in Listen ausgeblendet werden.
                </p>
              </div>
              <Switch
                id="ing-active"
                checked={active}
                onCheckedChange={(v) => setActive(v === true)}
              />
            </div>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitLabel="Anlegen"
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
