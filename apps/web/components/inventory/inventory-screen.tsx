"use client";

import {
  ArrowDown,
  ArrowUp,
  Filter,
  Package,
  Plus,
  ScrollText,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { IngredientDrawer } from "@/components/inventory/ingredient-drawer";
import { IngredientStockProtocolDrawer } from "@/components/inventory/ingredient-stock-protocol-drawer";
import { IngredientUsageDrawer } from "@/components/inventory/ingredient-usage-drawer";
import {
  countInventoryActiveFilters,
  InventoryFilterDrawer,
} from "@/components/inventory/inventory-filter-drawer";
import { InventoryScreenSkeleton } from "@/components/inventory/inventory-screen-skeleton";
import type { CategoryDrawerLabels } from "@/components/menu/category-drawer";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVENTORY_BRANDS_KEY,
  INVENTORY_INGREDIENT_CATEGORIES_KEY,
  INVENTORY_PRODUCTION_SITES_KEY,
  INVENTORY_SUPPLIERS_KEY,
  INVENTORY_UNITS_KEY,
} from "@/lib/constants/inventory-storage";
import {
  SEED_BRANDS,
  SEED_INGREDIENT_CATEGORIES,
  SEED_PRODUCTION_SITES,
  SEED_SUPPLIERS,
  SEED_UNITS,
} from "@/lib/data/inventory-seeds";
import type { AddPurchaseLineParams } from "@/lib/hooks/use-purchase-orders-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";
import {
  getDishesUsingIngredient,
  ingredientRowMatchesDishSearch,
} from "@/lib/menu/recipe-utils";
import type { MenuCategoryDefinition } from "@/lib/types/menu";
import type {
  Ingredient,
  InventoryTaxonomyDefinition,
} from "@/lib/types/inventory";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";

export type InventoryTaxonomyKind =
  | "supplier"
  | "ingredientCategory"
  | "productionSite"
  | "brand"
  | "unit";

type TaxonomyStore = {
  items: InventoryTaxonomyDefinition[];
  add: (
    name: string,
    active?: boolean,
  ) => Promise<{ id: string; name: string } | null>;
  update: (id: string, updates: { name?: string; active?: boolean }) => void;
  reorder: (next: InventoryTaxonomyDefinition[]) => void;
  remove: (id: string) => Promise<boolean>;
};

const MANAGE_BASE_DESC =
  "Reihenfolge per Ziehen ändern (wie Kategorien in der Speisekarte). Inaktive Einträge stehen in Zutaten-Auswahlfeldern nicht zur Verfügung.";

const KIND_UI: Record<
  InventoryTaxonomyKind,
  {
    short: string;
    manage: { title: string; description: string; newButton: string };
    drawer: Partial<CategoryDrawerLabels>;
  }
> = {
  supplier: {
    short: "Lieferanten",
    manage: {
      title: "Lieferanten",
      description: MANAGE_BASE_DESC,
      newButton: "Neuer Lieferant",
    },
    drawer: {
      titleCreate: "Neuer Lieferant",
      titleEdit: "Lieferant bearbeiten",
      description: "Name und Sichtbarkeit – Zuordnung bei Zutaten.",
      nameLabel: "Name",
      namePlaceholder: "z. B. Großmarkt Nord",
      activeDescription:
        "Inaktive Lieferanten erscheinen nicht in den Auswahlfeldern der Tabelle.",
    },
  },
  ingredientCategory: {
    short: "Kategorien",
    manage: {
      title: "Zutaten-Kategorien",
      description: MANAGE_BASE_DESC,
      newButton: "Neue Kategorie",
    },
    drawer: {
      titleCreate: "Neue Zutaten-Kategorie",
      titleEdit: "Zutaten-Kategorie bearbeiten",
      description: "Name und Sichtbarkeit – z. B. Trockenware, Kühlung.",
      namePlaceholder: "z. B. Tiefkühl",
      activeDescription:
        "Inaktive Kategorien erscheinen nicht in den Auswahlfeldern der Tabelle.",
    },
  },
  productionSite: {
    short: "Produktion",
    manage: {
      title: "Produktionsstellen",
      description: MANAGE_BASE_DESC,
      newButton: "Neue Produktionsstelle",
    },
    drawer: {
      titleCreate: "Neue Produktionsstelle",
      titleEdit: "Produktionsstelle bearbeiten",
      description: "Name und Sichtbarkeit – z. B. Hauptküche, Vorbereitung.",
      namePlaceholder: "z. B. Hauptküche",
      activeDescription:
        "Inaktive Stellen erscheinen nicht in den Auswahlfeldern der Tabelle.",
    },
  },
  brand: {
    short: "Marken",
    manage: {
      title: "Marken",
      description: MANAGE_BASE_DESC,
      newButton: "Neue Marke",
    },
    drawer: {
      titleCreate: "Neue Marke",
      titleEdit: "Marke bearbeiten",
      description: "Name und Sichtbarkeit – Zuordnung bei Zutaten.",
      namePlaceholder: "z. B. Hausmarke",
      activeDescription:
        "Inaktive Marken erscheinen nicht in den Auswahlfeldern der Tabelle.",
    },
  },
  unit: {
    short: "Einheiten",
    manage: {
      title: "Lagereinheiten",
      description: MANAGE_BASE_DESC,
      newButton: "Neue Einheit",
    },
    drawer: {
      titleCreate: "Neue Lagereinheit",
      titleEdit: "Lagereinheit bearbeiten",
      description:
        "Kurzbezeichnung für den Bestand (z. B. Gramm (g), Stück). Die Standard-IDs g und l sind mit bestehenden Zutaten abgestimmt.",
      namePlaceholder: "z. B. Stück",
      activeDescription:
        "Inaktive Einheiten stehen bei neuen Zutaten nicht zur Auswahl; in der Tabelle bleiben zugewiesene Einheiten lesbar.",
    },
  },
};

type SortKey =
  | "name"
  | "unit"
  | "currentStock"
  | "lowStockThreshold"
  | "supplierId"
  | "categoryId"
  | "productionSiteId"
  | "brandId";
type SortDir = "asc" | "desc";

const inputCellClass =
  "h-9 w-full min-w-[6rem] rounded-xl border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

/** Tabellen-Selects: Fokus / geöffnet wie andere Formularfelder (Ring + Border). */
const inventoryTableSelectTriggerClass =
  "h-9 min-h-9 w-full border border-input bg-transparent px-2 text-xs font-normal shadow-none transition-[border-color,box-shadow] outline-none hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 data-popup-open:border-ring data-popup-open:ring-[3px] data-popup-open:ring-ring/45";

function InventoryStockInputCell({
  ingredientId,
  currentStock,
  unitLabel,
  actor,
  onCommitStock,
}: {
  ingredientId: string;
  currentStock: number;
  unitLabel: string;
  actor: OrderProtocolActor;
  onCommitStock: (
    id: string,
    nextStock: number,
    unitLabel: string,
    actor: OrderProtocolActor,
  ) => void;
}) {
  const [draft, setDraft] = useState(() => String(currentStock));

  useEffect(() => {
    setDraft(String(currentStock));
  }, [ingredientId, currentStock]);

  const commit = useCallback(() => {
    const raw = draft.trim();
    const n = raw === "" ? NaN : Number.parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
      setDraft(String(currentStock));
      return;
    }
    if (n === currentStock) return;
    onCommitStock(ingredientId, n, unitLabel, actor);
  }, [actor, currentStock, draft, ingredientId, onCommitStock, unitLabel]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(inputCellClass, "tabular-nums")}
      aria-label="Bestand"
    />
  );
}

function InventoryThresholdInputCell({
  ingredientId,
  lowStockThreshold,
  onCommitThreshold,
}: {
  ingredientId: string;
  lowStockThreshold: number;
  onCommitThreshold: (id: string, nextThreshold: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(lowStockThreshold));

  useEffect(() => {
    setDraft(String(lowStockThreshold));
  }, [ingredientId, lowStockThreshold]);

  const commit = useCallback(() => {
    const raw = draft.trim();
    const n = raw === "" ? NaN : Number.parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      toast.error("Bitte eine gültige Schwelle (≥ 0) eingeben.");
      setDraft(String(lowStockThreshold));
      return;
    }
    if (n === lowStockThreshold) return;
    onCommitThreshold(ingredientId, n);
  }, [draft, ingredientId, lowStockThreshold, onCommitThreshold]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(inputCellClass, "tabular-nums")}
      aria-label="Mindestbestand-Schwelle"
      title="Benachrichtigung wenn Bestand ≤ Schwelle (0 = nur bei leerem Bestand)"
    />
  );
}

function InventoryOrderAddCell({
  ingredient,
  canOrder,
  supplierName,
  brandLabel,
  unitId,
  unitLabel,
  actor,
  openQty,
  openOrderId,
  openLineId,
  addLine,
  updateLineQuantity,
}: {
  ingredient: Ingredient;
  canOrder: boolean;
  supplierName: string;
  brandLabel: string;
  unitId: string;
  unitLabel: string;
  actor: OrderProtocolActor;
  openQty: number;
  openOrderId: string | null;
  openLineId: string | null;
  addLine: (p: AddPurchaseLineParams) => Promise<boolean>;
  updateLineQuantity: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() =>
    openLineId ? String(openQty) : "",
  );

  useEffect(() => {
    setDraft(openLineId ? String(openQty) : "");
  }, [openLineId, openQty]);

  const displayOrderQty = useMemo(() => {
    const t = draft.trim();
    if (t === "") return openLineId ? openQty : 0;
    const n = Number.parseFloat(t.replace(",", "."));
    return Number.isNaN(n) ? (openLineId ? openQty : 0) : n;
  }, [draft, openLineId, openQty]);

  const highlightOrderQty = canOrder && displayOrderQty > 0;

  const commit = useCallback(async () => {
    try {
    if (!canOrder) {
      toast.error(
        "Diese Zutat hat keinen Lieferanten in den Stammdaten und kann nicht bestellt werden.",
      );
      return;
    }
    const raw = draft.trim();
    let q: number;
    if (raw === "") {
      q = 0;
    } else {
      q = Number.parseFloat(raw.replace(",", "."));
      if (Number.isNaN(q) || q < 0) {
        toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
        setDraft(openLineId ? String(openQty) : "");
        return;
      }
    }
    if (q === openQty) return;
    if (!openLineId && q === 0) return;

    if (q === 0) {
      if (openOrderId && openLineId) {
        const ok = await updateLineQuantity(
          openOrderId,
          openLineId,
          0,
          actor,
        );
        if (!ok) {
          setDraft(openLineId ? String(openQty) : "");
        }
      }
      return;
    }

    if (!openLineId) {
      const ok = await addLine({
        supplierId: ingredient.supplierId,
        supplierName,
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        brandLabel,
        quantity: q,
        unitId,
        unitLabel,
        actor,
      });
      if (!ok) {
        setDraft("");
      }
      return;
    }
    if (openOrderId && openLineId) {
      const ok = await updateLineQuantity(
        openOrderId,
        openLineId,
        q,
        actor,
      );
      if (!ok) {
        setDraft(String(openQty));
      }
    }
    } catch (e) {
      console.warn("[gwada] Bestellmenge speichern", e);
      toast.error("Bestellung konnte nicht gespeichert werden.");
      setDraft(openLineId ? String(openQty) : "");
    }
  }, [
    addLine,
    brandLabel,
    canOrder,
    draft,
    ingredient,
    openLineId,
    openOrderId,
    openQty,
    supplierName,
    unitId,
    unitLabel,
    updateLineQuantity,
    actor,
  ]);

  return (
    <div className="flex min-w-[9rem] items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        disabled={!canOrder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="Menge"
        title={
          canOrder
            ? "Menge in der offenen Bestellung dieses Lieferanten (0 entfernt die Position)"
            : "Ohne Lieferant nicht bestellbar"
        }
        className={cn(
          inputCellClass,
          "min-w-0 flex-1 text-xs tabular-nums",
          !canOrder && "cursor-not-allowed opacity-50",
          highlightOrderQty &&
            "border-emerald-600 ring-2 ring-emerald-600/25 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/35 dark:border-emerald-500 dark:ring-emerald-500/25 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/35",
        )}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        disabled={!canOrder}
        className="shrink-0 rounded-xl"
        aria-label="Bestellmenge übernehmen"
        onClick={commit}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function InventoryTableTaxonomySelect({
  value,
  onValueChange,
  items,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: InventoryTaxonomyDefinition[];
  className?: string;
}) {
  const selectItems = useMemo(
    () => Object.fromEntries(items.map((s) => [s.id, s.name])),
    [items],
  )

  return (
    <Select
      value={value}
      items={selectItems}
      onValueChange={(v) => {
        if (typeof v === "string") onValueChange(v);
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          inventoryTableSelectTriggerClass,
          "min-w-[7.5rem]",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {items.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InventoryTableUnitSelect({
  value,
  onValueChange,
  units,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  units: InventoryTaxonomyDefinition[];
  className?: string;
}) {
  const selectItems = useMemo(
    () =>
      Object.fromEntries(
        units.map((u) => [
          u.id,
          `${u.name}${u.active === false ? " · inaktiv" : ""}`,
        ]),
      ),
    [units],
  )

  return (
    <Select
      value={value}
      items={selectItems}
      onValueChange={(v) => {
        if (typeof v === "string") onValueChange(v);
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn(inventoryTableSelectTriggerClass, "min-w-0", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {units.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
            {u.active === false ? " · inaktiv" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function InventoryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const suppliers = useInventoryTaxonomyStorage(
    INVENTORY_SUPPLIERS_KEY,
    SEED_SUPPLIERS,
  );
  const ingredientCategories = useInventoryTaxonomyStorage(
    INVENTORY_INGREDIENT_CATEGORIES_KEY,
    SEED_INGREDIENT_CATEGORIES,
  );
  const productionSites = useInventoryTaxonomyStorage(
    INVENTORY_PRODUCTION_SITES_KEY,
    SEED_PRODUCTION_SITES,
  );
  const brands = useInventoryTaxonomyStorage(INVENTORY_BRANDS_KEY, SEED_BRANDS);
  const units = useInventoryTaxonomyStorage(INVENTORY_UNITS_KEY, SEED_UNITS);
  const {
    ingredients,
    addIngredient,
    updateIngredient,
    removeIngredient,
    isHydrated: ingredientsHydrated,
  } = useIngredientsStorage();

  const { items: menuItems, isHydrated: menuHydrated } = useMenuStorage();
  const { actor, isHydrated: userNameHydrated } = usePersonalProfileNames();
  const {
    addLine,
    updateLineQuantity,
    isHydrated: ordersHydrated,
    getOpenLineContext,
  } = usePurchaseOrdersStorage();

  const [usageDrawer, setUsageDrawer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [stockProtocolIngredientId, setStockProtocolIngredientId] = useState<
    string | null
  >(null);
  const [ingredientDelete, setIngredientDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterProduction, setFilterProduction] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [manageKind, setManageKind] = useState<InventoryTaxonomyKind | null>(
    null,
  );
  const [entitySheet, setEntitySheet] = useState<
    | null
    | { kind: InventoryTaxonomyKind; mode: "create" }
    | {
        kind: InventoryTaxonomyKind;
        mode: "edit";
        item: InventoryTaxonomyDefinition;
      }
  >(null);
  const [ingredientDrawerOpen, setIngredientDrawerOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setIngredientDrawerOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const storeFor = useCallback(
    (kind: InventoryTaxonomyKind): TaxonomyStore => {
      switch (kind) {
        case "supplier":
          return suppliers;
        case "ingredientCategory":
          return ingredientCategories;
        case "productionSite":
          return productionSites;
        case "brand":
          return brands;
        case "unit":
          return units;
      }
    },
    [suppliers, ingredientCategories, productionSites, brands, units],
  );

  const nameById = useCallback(
    (list: InventoryTaxonomyDefinition[], id: string) =>
      list.find((x) => x.id === id)?.name ?? "—",
    [],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    let rows = [...ingredients];

    if (search.trim()) {
      const q = search.trim();
      rows = rows.filter((r) =>
        ingredientRowMatchesDishSearch(r.id, r.name, q, menuItems),
      );
    }
    if (filterSupplier !== "all") {
      rows = rows.filter((r) => r.supplierId === filterSupplier);
    }
    if (filterCategory !== "all") {
      rows = rows.filter((r) => r.categoryId === filterCategory);
    }
    if (filterProduction !== "all") {
      rows = rows.filter((r) => r.productionSiteId === filterProduction);
    }
    if (filterBrand !== "all") {
      rows = rows.filter((r) => r.brandId === filterBrand);
    }

    if (!sortKey) return rows;

    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Ingredient, b: Ingredient) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "de") * dir;
        case "unit":
          return (
            nameById(units.items, a.unit).localeCompare(
              nameById(units.items, b.unit),
              "de",
            ) * dir
          );
        case "currentStock":
          return (a.currentStock - b.currentStock) * dir;
        case "lowStockThreshold":
          return (
            ((a.lowStockThreshold ?? 0) - (b.lowStockThreshold ?? 0)) * dir
          );
        case "supplierId":
          return (
            nameById(suppliers.items, a.supplierId).localeCompare(
              nameById(suppliers.items, b.supplierId),
              "de",
            ) * dir
          );
        case "categoryId":
          return (
            nameById(ingredientCategories.items, a.categoryId).localeCompare(
              nameById(ingredientCategories.items, b.categoryId),
              "de",
            ) * dir
          );
        case "productionSiteId":
          return (
            nameById(productionSites.items, a.productionSiteId).localeCompare(
              nameById(productionSites.items, b.productionSiteId),
              "de",
            ) * dir
          );
        case "brandId":
          return (
            nameById(brands.items, a.brandId).localeCompare(
              nameById(brands.items, b.brandId),
              "de",
            ) * dir
          );
        default:
          return 0;
      }
    };
    rows.sort(cmp);
    return rows;
  }, [
    ingredients,
    search,
    filterSupplier,
    filterCategory,
    filterProduction,
    filterBrand,
    sortKey,
    sortDir,
    suppliers.items,
    ingredientCategories.items,
    productionSites.items,
    brands.items,
    units.items,
    nameById,
    menuItems,
  ]);

  const stockProtocolIngredient = useMemo(
    () =>
      stockProtocolIngredientId
        ? ingredients.find((i) => i.id === stockProtocolIngredientId) ?? null
        : null,
    [ingredients, stockProtocolIngredientId],
  );

  const commitStockChange = useCallback(
    (
      id: string,
      nextStock: number,
      unitLabel: string,
      act: OrderProtocolActor,
    ) => {
      void updateIngredient(
        id,
        { currentStock: nextStock },
        { stockActor: act, stockUnitLabel: unitLabel },
      );
    },
    [updateIngredient],
  );

  const commitThresholdChange = useCallback(
    (id: string, nextThreshold: number) => {
      void updateIngredient(id, { lowStockThreshold: nextThreshold });
    },
    [updateIngredient],
  );

  const SortHead = ({
    k,
    children,
    className,
    title,
  }: {
    k: SortKey;
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) => (
    <th
      className={cn("px-2 py-2 font-medium", className)}
      title={title}
    >
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-muted/60"
      >
        {children}
        {sortKey === k ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0 opacity-70" />
          ) : (
            <ArrowDown className="size-3.5 shrink-0 opacity-70" />
          )
        ) : null}
      </button>
    </th>
  );

  const filterActiveCount = useMemo(
    () =>
      countInventoryActiveFilters({
        filterSupplier,
        filterCategory,
        filterProduction,
        filterBrand,
      }),
    [filterBrand, filterCategory, filterProduction, filterSupplier],
  );

  const ready =
    ingredientsHydrated &&
    menuHydrated &&
    ordersHydrated &&
    userNameHydrated &&
    suppliers.isHydrated &&
    ingredientCategories.isHydrated &&
    productionSites.isHydrated &&
    brands.isHydrated &&
    units.isHydrated;

  return (
    <>
      {!ready ? (
        <InventoryScreenSkeleton />
      ) : (
        <div className="w-full">
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            "supplier",
            "ingredientCategory",
            "productionSite",
            "brand",
            "unit",
          ] as const
        ).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border/60"
            onClick={() => setManageKind(kind)}
          >
            {KIND_UI[kind].short} verwalten
          </Button>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <div className={moduleSearchFilterRowClassName}>
          <div className={moduleSearchFieldWrapClassName}>
            <Package
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zutaten suchen…"
              className={moduleSearchInputClassName}
              aria-label="Zutaten suchen"
            />
          </div>
          <div className={moduleSearchFilterButtonWrapClassName}>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className={moduleSearchFilterButtonClassName}
              aria-label="Filter"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="size-4" />
            </Button>
            {filterActiveCount > 0 ? (
              <Badge
                variant="secondary"
                className={moduleSearchFilterActiveBadgeClassName}
              >
                {filterActiveCount}
              </Badge>
            ) : null}
          </div>
        </div>
        {search.trim() ? (
          <p className="text-xs text-muted-foreground">
            Treffer: Zutatenname oder Speisen, in deren Rezept die Zutat
            vorkommt (ca. 80% Übereinstimmung).
          </p>
        ) : null}
      </div>

      <InventoryFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filterSupplier={filterSupplier}
        onFilterSupplierChange={setFilterSupplier}
        suppliers={suppliers.items}
        filterCategory={filterCategory}
        onFilterCategoryChange={setFilterCategory}
        categories={ingredientCategories.items}
        filterProduction={filterProduction}
        onFilterProductionChange={setFilterProduction}
        productionSites={productionSites.items}
        filterBrand={filterBrand}
        onFilterBrandChange={setFilterBrand}
        brands={brands.items}
      />

      <div className="mb-6">
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => setIngredientDrawerOpen(true)}
        >
          <Plus className="size-4" />
          Neue Zutat
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-none dark:shadow-sm">
        <table className="w-full min-w-[1260px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHead k="name" className="min-w-[10rem]">
                Name
              </SortHead>
              <SortHead k="currentStock" className="w-28">
                Bestand
              </SortHead>
              <SortHead
                k="lowStockThreshold"
                className="w-24"
                title="Benachrichtigung wenn Bestand ≤ Schwelle (0 = nur bei leerem Bestand)"
              >
                Schwelle
              </SortHead>
              <SortHead k="unit" className="w-20">
                Einheit
              </SortHead>
              <th className="min-w-[9.5rem] px-2 py-2 text-left text-xs font-medium tracking-wide text-muted-foreground normal-case">
                Bestellung
              </th>
              <SortHead k="supplierId" className="min-w-[8rem]">
                Lieferant
              </SortHead>
              <SortHead k="categoryId" className="min-w-[8rem]">
                Kategorie
              </SortHead>
              <SortHead k="productionSiteId" className="min-w-[8rem]">
                Produktion
              </SortHead>
              <SortHead k="brandId" className="min-w-[8rem]">
                Marke
              </SortHead>
              <th className="w-12 px-1 py-2 text-center" title="In Speisen">
                <UtensilsCrossed className="mx-auto size-3.5 opacity-70" aria-hidden />
              </th>
              <th className="w-12 px-1 py-2 text-center" title="Bestandsprotokoll">
                <ScrollText className="mx-auto size-3.5 opacity-70" aria-hidden />
              </th>
              <th className="w-12 px-2 py-2" aria-label="Löschen" />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Keine Zutaten für die aktuelle Suche oder Filter.
                </td>
              </tr>
            ) : (
              filteredSorted.map((row) => {
                const unitDef = units.items.find((u) => u.id === row.unit);
                const unitLabel =
                  unitDef != null
                    ? `${unitDef.name}${unitDef.active === false ? " · inaktiv" : ""}`
                    : row.unit;
                const canOrderRow = Boolean(row.supplierId?.trim());
                const orderCtx = getOpenLineContext(row.supplierId, row.id);

                return (
                <tr
                  key={row.id}
                  className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/60"
                >
                  <td className="px-2 py-1.5 align-middle">
                    <input
                      value={row.name}
                      onChange={(e) =>
                        void updateIngredient(row.id, { name: e.target.value })
                      }
                      className={inputCellClass}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryStockInputCell
                      ingredientId={row.id}
                      currentStock={row.currentStock}
                      unitLabel={unitLabel}
                      actor={actor}
                      onCommitStock={commitStockChange}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryThresholdInputCell
                      ingredientId={row.id}
                      lowStockThreshold={row.lowStockThreshold ?? 0}
                      onCommitThreshold={commitThresholdChange}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryTableUnitSelect
                      value={row.unit}
                      units={units.items}
                      onValueChange={(unit) =>
                        void updateIngredient(row.id, { unit })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryOrderAddCell
                      ingredient={row}
                      canOrder={canOrderRow}
                      supplierName={nameById(suppliers.items, row.supplierId)}
                      brandLabel={nameById(brands.items, row.brandId)}
                      unitId={row.unit}
                      unitLabel={unitLabel}
                      actor={actor}
                      openQty={orderCtx.quantity}
                      openOrderId={orderCtx.orderId}
                      openLineId={orderCtx.lineId}
                      addLine={addLine}
                      updateLineQuantity={updateLineQuantity}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryTableTaxonomySelect
                      value={row.supplierId}
                      onValueChange={(supplierId) =>
                        void updateIngredient(row.id, { supplierId })
                      }
                      items={suppliers.items}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryTableTaxonomySelect
                      value={row.categoryId}
                      onValueChange={(categoryId) =>
                        void updateIngredient(row.id, { categoryId })
                      }
                      items={ingredientCategories.items}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryTableTaxonomySelect
                      value={row.productionSiteId}
                      onValueChange={(productionSiteId) =>
                        void updateIngredient(row.id, { productionSiteId })
                      }
                      items={productionSites.items}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <InventoryTableTaxonomySelect
                      value={row.brandId}
                      onValueChange={(brandId) =>
                        void updateIngredient(row.id, { brandId })
                      }
                      items={brands.items}
                    />
                  </td>
                  <td className="px-1 py-1.5 align-middle text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Speisen mit dieser Zutat"
                      onClick={() =>
                        setUsageDrawer({ id: row.id, name: row.name })
                      }
                    >
                      <UtensilsCrossed className="size-4" />
                    </Button>
                  </td>
                  <td className="px-1 py-1.5 align-middle text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Bestandsprotokoll ${row.name}`}
                      onClick={() => setStockProtocolIngredientId(row.id)}
                    >
                      <ScrollText className="size-4" />
                    </Button>
                  </td>
                  <td className="px-1 py-1.5 align-middle text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Zutat entfernen"
                      onClick={() =>
                        setIngredientDelete({ id: row.id, name: row.name })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </div>
      )}

      <IngredientUsageDrawer
        open={usageDrawer !== null}
        onOpenChange={(o) => {
          if (!o) setUsageDrawer(null);
        }}
        ingredientName={usageDrawer?.name ?? ""}
        dishes={
          usageDrawer
            ? getDishesUsingIngredient(usageDrawer.id, menuItems)
            : []
        }
      />

      {manageKind !== null && (
        <CategoriesManageDrawer
          open
          onOpenChange={(o) => {
            if (!o) setManageKind(null);
          }}
          categories={storeFor(manageKind).items as MenuCategoryDefinition[]}
          copy={KIND_UI[manageKind].manage}
          onReorder={(next) =>
            storeFor(manageKind).reorder(
              next as InventoryTaxonomyDefinition[],
            )
          }
          onEdit={(cat) => {
            setEntitySheet({
              kind: manageKind,
              mode: "edit",
              item: cat as InventoryTaxonomyDefinition,
            });
            setManageKind(null);
          }}
          onNew={() => {
            setEntitySheet({ kind: manageKind, mode: "create" });
          }}
        />
      )}

      {entitySheet !== null && (
        <CategoryDrawer
          open
          onOpenChange={(o) => {
            if (!o) setEntitySheet(null);
          }}
          mode={entitySheet.mode === "edit" ? "edit" : "create"}
          initial={
            entitySheet.mode === "edit"
              ? (entitySheet.item as MenuCategoryDefinition)
              : null
          }
          labels={KIND_UI[entitySheet.kind].drawer}
          onSave={async (payload) => {
            const s = storeFor(entitySheet.kind);
            if ("id" in payload && payload.id) {
              s.update(payload.id, {
                name: payload.name,
                active: payload.active,
              });
            } else {
              await s.add(payload.name, payload.active !== false);
            }
          }}
          onDelete={
            entitySheet.mode === "edit" && entitySheet.item
              ? (id) => void storeFor(entitySheet.kind).remove(id)
              : undefined
          }
        />
      )}

      <IngredientStockProtocolDrawer
        ingredient={stockProtocolIngredient}
        open={stockProtocolIngredientId !== null}
        onOpenChange={(o) => {
          if (!o) setStockProtocolIngredientId(null);
        }}
      />

      <IngredientDrawer
        open={ingredientDrawerOpen}
        onOpenChange={setIngredientDrawerOpen}
        onCreate={async (row) => (await addIngredient(row)) != null}
        suppliers={suppliers.items}
        ingredientCategories={ingredientCategories.items}
        productionSites={productionSites.items}
        brands={brands.items}
        units={units.items}
      />

      <ConfirmDialog
        open={ingredientDelete !== null}
        onOpenChange={(o) => {
          if (!o) setIngredientDelete(null);
        }}
        title="Zutat wirklich löschen?"
        description={
          ingredientDelete ? (
            <>
              „{ingredientDelete.name}“ wird aus dem Bestand entfernt. Verknüpfungen
              in der Speisekarte können betroffen sein.
            </>
          ) : null
        }
        confirmLabel="Ja, löschen"
        onConfirm={async () => {
          if (ingredientDelete) await removeIngredient(ingredientDelete.id);
        }}
      />
    </>
  );
}
