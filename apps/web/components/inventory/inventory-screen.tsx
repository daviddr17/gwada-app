"use client";

import type { LucideIcon } from "lucide-react";
import {
  Factory,
  Filter,
  Layers,
  Package,
  Plus,
  Ruler,
  ScrollText,
  Tag,
  Trash2,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { IngredientDrawer } from "@/components/inventory/ingredient-drawer";
import { InventoryMobileStockList } from "@/components/inventory/inventory-mobile-stock-list";
import { IngredientStockProtocolDrawer } from "@/components/inventory/ingredient-stock-protocol-drawer";
import { IngredientUsageDrawer } from "@/components/inventory/ingredient-usage-drawer";
import {
  countInventoryActiveFilters,
  InventoryFilterDrawer,
} from "@/components/inventory/inventory-filter-drawer";
import { InventoryScreenSkeleton } from "@/components/inventory/inventory-screen-skeleton";
import { InventoryTableExportSheet } from "@/components/inventory/inventory-table-export-sheet";
import type { CategoryDrawerLabels } from "@/components/menu/category-drawer";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
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
import {
  formatPurchaseUnitPriceDisplay,
  parsePurchaseUnitPriceInput,
} from "@/lib/inventory/format-purchase-unit-price";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead, hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
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
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleDataTableHeadCellDenseClassName,
  moduleDataTableHeadLabelClassName,
  moduleDataTableHeadRowSortableClassName,
  moduleListPaginationAboveClassName,
  moduleListPaginationBelowClassName,
  moduleTableFullscreenChromeInsetDenseClassName,
} from "@/lib/ui/module-data-table";
import { ModuleTableSortHeader } from "@/lib/ui/module-table-sort-header";
import { ModuleTableStickyBodyCell } from "@/lib/ui/module-table-sticky-column";
import {
  ModuleTableActionsCell,
  ModuleTableIconActionButton,
  ModuleTableIconActionsColumnHeader,
} from "@/lib/ui/module-table-icon-tooltip";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
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

const KIND_ICON: Record<InventoryTaxonomyKind, LucideIcon> = {
  supplier: Truck,
  ingredientCategory: Layers,
  productionSite: Factory,
  brand: Tag,
  unit: Ruler,
};

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
  | "purchaseUnitPrice"
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

function InventoryPurchasePriceInputCell({
  ingredientId,
  purchaseUnitPrice,
  lastPriceChangeAt,
  onCommitPrice,
}: {
  ingredientId: string;
  purchaseUnitPrice: number | null | undefined;
  lastPriceChangeAt?: string | null;
  onCommitPrice: (id: string, nextPrice: number | null) => void;
}) {
  const [draft, setDraft] = useState(() =>
    formatPurchaseUnitPriceDisplay(purchaseUnitPrice),
  );

  useEffect(() => {
    setDraft(formatPurchaseUnitPriceDisplay(purchaseUnitPrice));
  }, [ingredientId, purchaseUnitPrice]);

  const commit = useCallback(() => {
    const raw = draft.trim();
    if (raw === "") {
      if (purchaseUnitPrice == null) return;
      onCommitPrice(ingredientId, null);
      return;
    }
    const n = parsePurchaseUnitPriceInput(raw);
    if (n == null) {
      toast.error("Bitte einen gültigen Einkaufspreis (≥ 0) eingeben.");
      setDraft(formatPurchaseUnitPriceDisplay(purchaseUnitPrice));
      return;
    }
    setDraft(formatPurchaseUnitPriceDisplay(n));
    if (purchaseUnitPrice != null && n === purchaseUnitPrice) return;
    onCommitPrice(ingredientId, n);
  }, [draft, ingredientId, onCommitPrice, purchaseUnitPrice]);

  const lastChangeLabel = lastPriceChangeAt
    ? new Date(lastPriceChangeAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

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
      className={cn(inputCellClass, "min-w-[5rem] tabular-nums")}
      aria-label="Einkaufspreis pro Einheit"
      title={
        lastChangeLabel
          ? `Zuletzt geändert: ${lastChangeLabel}`
          : "Einkaufspreis pro Lagereinheit (EUR)"
      }
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
  const { profile } = useRestaurantProfile();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "inventory");
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

  const [sortKey, setSortKey] = useState<SortKey | null>("categoryId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

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
        case "purchaseUnitPrice":
          return (
            ((a.purchaseUnitPrice ?? -1) - (b.purchaseUnitPrice ?? -1)) * dir
          );
        case "supplierId":
          return (
            nameById(suppliers.items, a.supplierId).localeCompare(
              nameById(suppliers.items, b.supplierId),
              "de",
            ) * dir
          );
        case "categoryId": {
          const cat =
            nameById(ingredientCategories.items, a.categoryId).localeCompare(
              nameById(ingredientCategories.items, b.categoryId),
              "de",
            ) * dir;
          if (cat !== 0) return cat;
          return a.name.localeCompare(b.name, "de") * dir;
        }
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

  const totalCount = filteredSorted.length;
  const totalPages = totalPagesFromCount(totalCount, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filteredSorted.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [filteredSorted, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterSupplier,
    filterCategory,
    filterProduction,
    filterBrand,
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

  const commitPurchasePriceChange = useCallback(
    (id: string, nextPrice: number | null) => {
      void updateIngredient(id, { purchaseUnitPrice: nextPrice });
    },
    [updateIngredient],
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

  const restaurantName = profile.name.trim() || undefined;

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

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Bestand" />;
  }

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
        ).map((kind) => {
          const KindIcon = KIND_ICON[kind];
          return (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            className={moduleManageChipButtonClassName}
            onClick={() => setManageKind(kind)}
          >
            <KindIcon className="size-4" />
            {KIND_UI[kind].short}
          </Button>
          );
        })}
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

      <div className="md:hidden">
        <ListPaginationSurround
          page={currentPage}
          totalPages={totalPages}
          shown={paginatedRows.length}
          totalCount={totalCount}
          itemLabel="Zutaten"
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          classNameAbove={moduleListPaginationAboveClassName}
          classNameBelow={moduleListPaginationBelowClassName}
        >
          <InventoryMobileStockList
            rows={paginatedRows}
            unitLabelById={(unitId) => {
              const unitDef = units.items.find((u) => u.id === unitId);
              return unitDef != null
                ? `${unitDef.name}${unitDef.active === false ? " · inaktiv" : ""}`
                : unitId;
            }}
            metaLineForRow={(row) => {
              const parts = [
                nameById(ingredientCategories.items, row.categoryId),
                nameById(suppliers.items, row.supplierId),
                nameById(brands.items, row.brandId),
              ].filter((s) => s.trim().length > 0 && s !== "—");
              return parts.length > 0 ? parts.join(" · ") : null;
            }}
            actor={actor}
            onCommitStock={commitStockChange}
            onOpenUsage={(row) =>
              setUsageDrawer({ id: row.id, name: row.name })
            }
            onOpenProtocol={(row) => setStockProtocolIngredientId(row.id)}
            onDelete={(row) =>
              setIngredientDelete({ id: row.id, name: row.name })
            }
          />
        </ListPaginationSurround>
      </div>

      <div className="hidden md:block">
      <ModulePaginatedDataTable
        page={currentPage}
        totalPages={totalPages}
        shown={paginatedRows.length}
        totalCount={totalCount}
        itemLabel="Zutaten"
        fullscreenChromeInsetClassName={
          moduleTableFullscreenChromeInsetDenseClassName
        }
        canPrevious={currentPage > 1}
        canNext={currentPage < totalPages}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        renderTableExportSheet={({ open, onOpenChange }) => (
          <InventoryTableExportSheet
            open={open}
            onOpenChange={onOpenChange}
            ingredients={ingredients}
            suppliers={suppliers.items}
            categories={ingredientCategories.items}
            productionSites={productionSites.items}
            brands={brands.items}
            units={units.items}
            menuItems={menuItems}
            restaurantName={restaurantName}
            initialSearch={search}
            initialFilters={{
              supplierId: filterSupplier,
              categoryId: filterCategory,
              productionSiteId: filterProduction,
              brandId: filterBrand,
            }}
          />
        )}
      >
        <table className="w-full min-w-[1340px] text-sm">
          <thead>
            <tr className={moduleDataTableHeadRowSortableClassName}>
              <ModuleTableSortHeader
                label="Name"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                stickyIdentityColumn
                className="min-w-[10rem] px-2 py-2"
              />
              <ModuleTableSortHeader
                label="Bestand"
                sortKey="currentStock"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="w-28 px-2 py-2"
              />
              <ModuleTableSortHeader
                label="Schwelle"
                sortKey="lowStockThreshold"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="w-24 px-2 py-2"
                ariaLabel="Schwelle sortieren — Benachrichtigung wenn Bestand ≤ Schwelle"
              />
              <ModuleTableSortHeader
                label="EK"
                sortKey="purchaseUnitPrice"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="w-24 px-2 py-2"
                ariaLabel="Einkaufspreis pro Einheit sortieren"
              />
              <ModuleTableSortHeader
                label="Einheit"
                sortKey="unit"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="w-20 px-2 py-2"
              />
              <th
                className={cn(
                  moduleDataTableHeadCellDenseClassName,
                  "min-w-[9.5rem] normal-case",
                )}
              >
                <span className={moduleDataTableHeadLabelClassName}>
                  Bestellung
                </span>
              </th>
              <ModuleTableSortHeader
                label="Lieferant"
                sortKey="supplierId"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="min-w-[8rem] px-2 py-2"
              />
              <ModuleTableSortHeader
                label="Kategorie"
                sortKey="categoryId"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="min-w-[8rem] px-2 py-2"
              />
              <ModuleTableSortHeader
                label="Produktion"
                sortKey="productionSiteId"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="min-w-[8rem] px-2 py-2"
              />
              <ModuleTableSortHeader
                label="Marke"
                sortKey="brandId"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="min-w-[8rem] px-2 py-2"
              />
              <ModuleTableIconActionsColumnHeader
                dense
                className="min-w-[7.5rem] w-[7.5rem]"
              />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Keine Zutaten für die aktuelle Suche oder Filter.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
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
                  className="group/tr border-b border-border/40 transition-colors last:border-0 hover:bg-muted/60"
                >
                  <ModuleTableStickyBodyCell
                    tone="muted-hover-60"
                    className="px-2 py-1.5 align-middle"
                  >
                    <input
                      value={row.name}
                      onChange={(e) =>
                        void updateIngredient(row.id, { name: e.target.value })
                      }
                      className={inputCellClass}
                    />
                  </ModuleTableStickyBodyCell>
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
                    <InventoryPurchasePriceInputCell
                      ingredientId={row.id}
                      purchaseUnitPrice={row.purchaseUnitPrice}
                      lastPriceChangeAt={row.lastPriceChangeAt}
                      onCommitPrice={commitPurchasePriceChange}
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
                  <ModuleTableActionsCell dense>
                    <ModuleTableIconActionButton
                      label="Speisen mit dieser Zutat"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setUsageDrawer({ id: row.id, name: row.name })
                      }
                    >
                      <UtensilsCrossed className="size-4" />
                    </ModuleTableIconActionButton>
                    <ModuleTableIconActionButton
                      label={`Bestandsprotokoll ${row.name}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setStockProtocolIngredientId(row.id)}
                    >
                      <ScrollText className="size-4" />
                    </ModuleTableIconActionButton>
                    <ModuleTableIconActionButton
                      label="Zutat löschen"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setIngredientDelete({ id: row.id, name: row.name })
                      }
                    >
                      <Trash2 className="size-4" />
                    </ModuleTableIconActionButton>
                  </ModuleTableActionsCell>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ModulePaginatedDataTable>
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
