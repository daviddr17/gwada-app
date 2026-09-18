"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { IngredientThumb } from "@/components/inventory/ingredient-thumb";
import { uploadIngredientImage } from "@/lib/inventory/ingredient-image";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { Switch } from "@/components/ui/switch";
import {
  isIosTouchDevice,
  useDrawerFormKeyboardAssist,
} from "@/lib/hooks/use-drawer-form-keyboard-assist";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import type {
  Ingredient,
  IngredientStockUnit,
  InventoryTaxonomyDefinition,
  NewIngredient,
} from "@/lib/types/inventory";
import {
  formatPurchaseUnitPriceDisplay,
  parsePurchaseUnitPriceInput,
} from "@/lib/inventory/format-purchase-unit-price";

type IngredientDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create-Modus (Standard). */
  onCreate?: (row: NewIngredient) => boolean | Promise<boolean>;
  /** Edit-Modus — wenn gesetzt und `initial` vorhanden. */
  onSave?: (
    id: string,
    patch: Partial<Ingredient>,
  ) => boolean | Promise<boolean>;
  initial?: Ingredient | null;
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
  onSave,
  initial = null,
  suppliers,
  ingredientCategories,
  productionSites,
  brands,
  units,
}: IngredientDrawerProps) {
  const mode = initial ? "edit" : "create";
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { repositionInputs } = useDrawerFormKeyboardAssist({ open, scrollRef });
  const [iosTouch, setIosTouch] = useState(false);
  const [name, setName] = useState("");
  const [articleNumber, setArticleNumber] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [unit, setUnit] = useState<IngredientStockUnit>("g");
  const [currentStock, setCurrentStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productionSiteId, setProductionSiteId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIosTouch(isIosTouchDevice());
  }, []);

  useDrawerFormSeed(open, initial?.id ?? "__create__", () => {
    if (initial) {
      setName(initial.name);
      setArticleNumber(initial.articleNumber ?? "");
      setImagePath(initial.imagePath ?? null);
      setPendingFile(null);
      setPreviewUrl((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return null;
      });
      setUnit(initial.unit || firstActiveId(units) || "g");
      setCurrentStock(String(initial.currentStock ?? 0));
      setLowStockThreshold(String(initial.lowStockThreshold ?? 0));
      setPurchaseUnitPrice(
        initial.purchaseUnitPrice != null
          ? formatPurchaseUnitPriceDisplay(initial.purchaseUnitPrice)
          : "",
      );
      setSupplierId(initial.supplierId || firstActiveId(suppliers));
      setCategoryId(initial.categoryId || firstActiveId(ingredientCategories));
      setProductionSiteId(
        initial.productionSiteId || firstActiveId(productionSites),
      );
      setBrandId(initial.brandId || firstActiveId(brands));
      setActive(initial.active !== false);
      return;
    }
    setName("");
    setArticleNumber("");
    setImagePath(null);
    setPendingFile(null);
    setPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setUnit(firstActiveId(units) || "g");
    setCurrentStock("0");
    setLowStockThreshold("0");
    setPurchaseUnitPrice("");
    setSupplierId(firstActiveId(suppliers));
    setCategoryId(firstActiveId(ingredientCategories));
    setProductionSiteId(firstActiveId(productionSites));
    setBrandId(firstActiveId(brands));
    setActive(true);
  });

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
    if (!trimmed) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }
    const stock = Number.parseFloat(currentStock.replace(",", "."));
    if (Number.isNaN(stock) || stock < 0) {
      toast.error("Bitte einen gültigen Bestand (≥ 0) eingeben.");
      return;
    }
    const threshold = Number.parseFloat(lowStockThreshold.replace(",", "."));
    if (Number.isNaN(threshold) || threshold < 0) {
      toast.error("Bitte eine gültige Schwelle (≥ 0) eingeben.");
      return;
    }
    let parsedPrice: number | null = null;
    const priceRaw = purchaseUnitPrice.trim();
    if (priceRaw !== "") {
      parsedPrice = parsePurchaseUnitPriceInput(priceRaw);
      if (parsedPrice == null) {
        toast.error("Bitte einen gültigen Einkaufspreis eingeben.");
        return;
      }
    }

    void (async () => {
      setSaving(true);
      try {
        let nextImagePath = imagePath;
        if (pendingFile) {
          if (!restaurantId) {
            toast.error("Restaurant ist noch nicht bereit.");
            return;
          }
          const uploaded = await uploadIngredientImage(restaurantId, pendingFile);
          if ("error" in uploaded) {
            toast.error(uploaded.error);
            return;
          }
          nextImagePath = uploaded.path;
        }
        const article = articleNumber.trim() || null;
        const shared = {
          name: trimmed,
          articleNumber: article,
          imagePath: nextImagePath,
          unit,
          currentStock: stock,
          lowStockThreshold: threshold,
          purchaseUnitPrice: parsedPrice,
          supplierId: supplierId || firstActiveId(suppliers),
          categoryId: categoryId || firstActiveId(ingredientCategories),
          productionSiteId:
            productionSiteId || firstActiveId(productionSites),
          brandId: brandId || firstActiveId(brands),
          active,
        };
        if (mode === "edit" && initial && onSave) {
          const ok = await Promise.resolve(onSave(initial.id, shared));
          if (ok) onOpenChange(false);
          return;
        }
        if (!onCreate) return;
        onOpenChange(false);
        const ok = await Promise.resolve(onCreate(shared));
        if (!ok) toast.error("Zutat konnte nicht angelegt werden.");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={repositionInputs}
    >
      <DrawerContent className={drawerContentClassName("formMd")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? "Zutat bearbeiten" : "Neue Zutat"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {mode === "edit"
              ? "Name, Bestand und Zuordnungen anpassen."
              : "Bestand und Zuordnungen – später mit Lagerbuchung verknüpfbar."}
          </DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div ref={scrollRef} className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Stammdaten">
              <div className="space-y-2">
                <Label htmlFor="ing-name">Name</Label>
                <Input
                  id="ing-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. schwarzer Pfeffer"
                  className="h-12 rounded-xl"
                  autoFocus={!iosTouch}
                  enterKeyHint="done"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ing-article">Artikelnummer</Label>
                <Input
                  id="ing-article"
                  value={articleNumber}
                  onChange={(e) => setArticleNumber(e.target.value)}
                  placeholder="z. B. 4711-12"
                  className="h-12 rounded-xl"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ing-image">Bild</Label>
                <div className="flex items-center gap-3">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- lokale Blob-Vorschau
                    <img
                      src={previewUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-xl border border-border/50 object-cover"
                    />
                  ) : (
                    <IngredientThumb
                      imagePath={imagePath}
                      className="size-14 rounded-xl"
                    />
                  )}
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => fileRef.current?.click()}
                    >
                      {imagePath || pendingFile ? "Bild ersetzen" : "Bild wählen"}
                    </Button>
                    {imagePath || pendingFile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => {
                          setPendingFile(null);
                          setImagePath(null);
                          setPreviewUrl((current) => {
                            if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
                            return null;
                          });
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        Entfernen
                      </Button>
                    ) : null}
                  </div>
                  <input
                    ref={fileRef}
                    id="ing-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setPendingFile(file);
                      setPreviewUrl((current) => {
                        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
                        return file ? URL.createObjectURL(file) : null;
                      });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG oder WebP, maximal 5 MB.
                </p>
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
                    <SelectTrigger
                      id="ing-unit"
                      className="h-11 w-full rounded-xl"
                    >
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
                <Label htmlFor="ing-threshold">Schwelle</Label>
                <Input
                  id="ing-threshold"
                  inputMode="decimal"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Benachrichtigung, wenn Bestand ≤ Schwelle.
                </p>
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
                  onBlur={() => {
                    const parsed =
                      parsePurchaseUnitPriceInput(purchaseUnitPrice);
                    if (parsed != null) {
                      setPurchaseUnitPrice(
                        formatPurchaseUnitPriceDisplay(parsed),
                      );
                    }
                  }}
                  placeholder="optional, z. B. 2,50"
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  EUR pro Lagereinheit — Grundlage für Food-Cost in Rezepten.
                </p>
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Status">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="ing-active" className="text-sm font-medium">
                    Aktiv
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Inaktive Zutaten erscheinen gedämpft in der Liste und zählen
                    nicht als leerer Bestand unter Heute.
                  </p>
                </div>
                <Switch
                  id="ing-active"
                  checked={active}
                  onCheckedChange={(v) => setActive(v === true)}
                />
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
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitLabel={mode === "edit" ? "Speichern" : "Anlegen"}
            submitDisabled={saving}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
