"use client";

import { useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
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
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState("");
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
      setPurchaseUnitPrice("");
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

  const selectedUnitLabel = useMemo(() => {
    const u = units.find((x) => x.id === unit);
    return u?.name ?? unit;
  }, [unit, units]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const stock = Number.parseFloat(currentStock.replace(",", "."));
    if (Number.isNaN(stock) || stock < 0) return;
    let parsedPrice: number | null = null;
    const priceRaw = purchaseUnitPrice.trim();
    if (priceRaw !== "") {
      const p = Number.parseFloat(priceRaw.replace(",", "."));
      if (Number.isNaN(p) || p < 0) return;
      parsedPrice = p;
    }
    void (async () => {
      const ok = await Promise.resolve(
        onCreate({
          name: trimmed,
          unit,
          currentStock: stock,
          purchaseUnitPrice: parsedPrice,
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
        className={drawerContentClassName("template")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Neue Zutat
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Bestand und Zuordnungen – später mit Lagerbuchung verknüpfbar.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Stammdaten">
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
                <Label htmlFor="ing-price">
                  Einkaufspreis pro {selectedUnitLabel}
                </Label>
                <Input
                  id="ing-price"
                  inputMode="decimal"
                  value={purchaseUnitPrice}
                  onChange={(e) => setPurchaseUnitPrice(e.target.value)}
                  placeholder="optional, z. B. 2,50"
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  EUR pro Lagereinheit — Grundlage für Food-Cost in Rezepten.
                </p>
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Zuordnung">
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
            </DrawerFormSection>

            <DrawerFormSection title="Status">
              <div className="flex items-center justify-between gap-4">
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
            </DrawerFormSection>
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
