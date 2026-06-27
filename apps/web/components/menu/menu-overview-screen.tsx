"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  LayoutGrid,
  Plus,
  Table2,
  Tags,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { MenuCompactItemsTable } from "@/components/menu/menu-compact-items-table";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { DishDrawer } from "@/components/menu/dish-drawer";
import { FilterDrawer } from "@/components/menu/filter-drawer";
import { MenuTaxonomyDrawer } from "@/components/menu/menu-taxonomy-drawer";
import { MenuCategoryTabs } from "@/components/menu/menu-category-tabs";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { MenuOverviewSkeleton } from "@/components/menu/menu-overview-skeleton";
import { MenuSearchFilters } from "@/components/menu/menu-search-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_CATEGORIES } from "@/lib/constants/categories";
import { buildDietFilterOptions } from "@/lib/constants/menu-labels";
import {
  MENU_TAXONOMY_ALLERGENS_KEY,
  MENU_TAXONOMY_TAGS_KEY,
  SEED_MENU_ALLERGEN_DEFINITIONS,
  SEED_MENU_TAG_DEFINITIONS,
} from "@/lib/constants/menu-taxonomy-storage";
import { useCategoriesStorage } from "@/lib/hooks/use-categories-storage";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useMenuTaxonomyStorage } from "@/lib/hooks/use-menu-taxonomy-storage";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";
import {
  isCategoryActive,
  sortItemsInCategoryForDisplay,
} from "@/lib/menu/item-utils";
import { itemMatchesIngredientSearch } from "@/lib/menu/recipe-utils";
import { fuzzyTextMatchesQuery } from "@/lib/utils/fuzzy-search";
import type {
  DietFilter,
  MenuCategoryDefinition,
  MenuItem,
  MenuTaxonomyDefinition,
  PriceRange,
} from "@/lib/types/menu";
import { useMenuSettings } from "@/lib/hooks/use-menu-settings";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  hasModuleCreate,
  hasModuleDelete,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { ListRangeCount } from "@/lib/ui/list-range-count";
import { cn } from "@/lib/utils";
import { useMenuViewMode } from "@/hooks/use-menu-view-mode";
import { readModuleChipStripHeightPx } from "@/lib/layout/module-chip-strip";
import { getAppScrollRoot } from "@/lib/layout/app-scroll-root";

const APP_HEADER_PX = 53; /* --app-chrome-header-h: p-2 + h-9 + p-2 + border */

const MENU_BASE = "/dashboard/menu/uebersicht";

export function MenuOverviewScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { restaurantId: workspaceRestaurantId } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "menu");
  const canCreate = hasModuleCreate(has, "menu");
  const canUpdate = hasModuleUpdate(has, "menu");
  const canDelete = hasModuleDelete(has, "menu");
  const { currencyCode } = useMenuSettings(workspaceRestaurantId);
  const {
    categories,
    addCategory,
    updateCategory,
    reorderCategories,
    deleteCategory,
    isHydrated: categoriesHydrated,
  } = useCategoriesStorage();
  const {
    items,
    addItem,
    updateItem,
    deleteItem,
    getItemById,
    reorderItemsInCategory,
    isHydrated: menuHydrated,
  } = useMenuStorage();

  const { ingredients, isHydrated: ingredientsHydrated } =
    useIngredientsStorage();

  const menuTags = useMenuTaxonomyStorage(
    MENU_TAXONOMY_TAGS_KEY,
    SEED_MENU_TAG_DEFINITIONS,
  );
  const menuAllergens = useMenuTaxonomyStorage(
    MENU_TAXONOMY_ALLERGENS_KEY,
    SEED_MENU_ALLERGEN_DEFINITIONS,
  );

  const mergedTagDefinitions = useMemo(
    () => [...menuTags.items, ...menuAllergens.items],
    [menuTags.items, menuAllergens.items],
  );

  const dietFilterOptions = useMemo(
    () => buildDietFilterOptions(mergedTagDefinitions),
    [mergedTagDefinitions],
  );

  const { mode: viewMode, setMode: setViewMode, ready: viewReady } =
    useMenuViewMode();

  const isHydrated =
    categoriesHydrated &&
    menuHydrated &&
    ingredientsHydrated &&
    menuTags.isHydrated &&
    menuAllergens.isHydrated;

  const ingredientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const ing of ingredients) {
      m.set(ing.id, ing.name);
    }
    return m;
  }, [ingredients]);

  const [search, setSearch] = useState("");
  const [dietFilter, setDietFilter] = useState<DietFilter>("all");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    DEFAULT_CATEGORIES[0].id,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [taxonomyManage, setTaxonomyManage] = useState<"tags" | "allergens" | null>(
    null,
  );
  const [taxonomySheet, setTaxonomySheet] = useState<
    | null
    | { group: "tags" | "allergens"; mode: "create" }
    | {
        group: "tags" | "allergens";
        mode: "edit";
        initial: MenuTaxonomyDefinition;
      }
  >(null);
  const [categorySheet, setCategorySheet] = useState<
    | null
    | { mode: "create" }
    | { mode: "edit"; cat: MenuCategoryDefinition }
  >(null);

  const stickyRef = useRef<HTMLDivElement>(null);
  const skipScrollSpyRef = useRef(false);

  const dishId = searchParams.get("dish");
  const isNew = searchParams.get("new") === "1";
  const drawerOpen = Boolean(dishId || isNew);
  const drawerMode = dishId ? "edit" : "create";
  const editItem = dishId ? getItemById(dishId) : undefined;

  const priceSliderMax = useMemo(() => {
    if (items.length === 0) return 50;
    return Math.max(50, Math.ceil(Math.max(...items.map((i) => i.price))));
  }, [items]);

  const [priceRange, setPriceRange] = useState<PriceRange>([0, 50]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPriceRange(([lo, hi]) => {
        const cap = priceSliderMax;
        const nextLo = Math.min(Math.max(0, lo), cap);
        const nextHi = Math.min(Math.max(nextLo, hi), cap);
        return [nextLo, nextHi];
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [priceSliderMax]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!categories.some((c) => c.id === activeCategoryId) && categories[0]) {
        setActiveCategoryId(categories[0].id);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [categories, activeCategoryId]);

  useEffect(() => {
    if (dietFilter === "all") return;
    const stillThere = dietFilterOptions.some((o) => o.value === dietFilter);
    if (!stillThere) {
      const id = requestAnimationFrame(() => setDietFilter("all"));
      return () => cancelAnimationFrame(id);
    }
  }, [dietFilter, dietFilterOptions]);

  const passItemFilters = useCallback(
    (item: MenuItem) => {
      if (dietFilter !== "all" && !item.tags.includes(dietFilter)) return false;
      if (item.price < priceRange[0] || item.price > priceRange[1]) return false;
      const q = search.trim();
      if (!q) return true;
      if (
        fuzzyTextMatchesQuery(item.name, q) ||
        fuzzyTextMatchesQuery(item.description, q)
      ) {
        return true;
      }
      return itemMatchesIngredientSearch(item, q, ingredientNameById);
    },
    [dietFilter, priceRange, search, ingredientNameById],
  );

  const sections = useMemo(() => {
    return categories.map((cat) => ({
      cat,
      items: sortItemsInCategoryForDisplay(
        items.filter((i) => i.category === cat.id && passItemFilters(i)),
      ),
    }));
  }, [categories, items, passItemFilters]);

  const visibleItemCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.items.length, 0),
    [sections],
  );

  const hasNonDefaultFilters = useMemo(() => {
    return (
      dietFilter !== "all" ||
      search.trim().length > 0 ||
      priceRange[0] > 0 ||
      priceRange[1] < priceSliderMax
    );
  }, [dietFilter, search, priceRange, priceSliderMax]);

  const anyFilteredMatch = sections.some((s) => s.items.length > 0);

  useEffect(() => {
    if (!hasNonDefaultFilters) return;
    const mine =
      sections.find((s) => s.cat.id === activeCategoryId)?.items.length ?? 0;
    if (mine > 0) return;
    const first = sections.find((s) => s.items.length > 0);
    if (first) setActiveCategoryId(first.cat.id);
  }, [hasNonDefaultFilters, sections, activeCategoryId]);

  const scrollToCategory = useCallback((id: string) => {
    skipScrollSpyRef.current = true;
    setActiveCategoryId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`menu-cat-${id}`);
      const sticky = stickyRef.current;
      const chipPx = readModuleChipStripHeightPx();
      if (!el) {
        window.setTimeout(() => {
          skipScrollSpyRef.current = false;
        }, 100);
        return;
      }
      const stickyH = sticky?.offsetHeight ?? 0;
      const pad = 8;
      const root = getAppScrollRoot();
      if (root) {
        const elRect = el.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const delta = elRect.top - rootRect.top - stickyH - pad;
        root.scrollTo({
          top: Math.max(0, root.scrollTop + delta),
          behavior: "smooth",
        });
      } else {
        const rect = el.getBoundingClientRect();
        window.scrollTo({
          top:
            window.scrollY +
            rect.top -
            APP_HEADER_PX -
            chipPx -
            stickyH -
            pad,
          behavior: "smooth",
        });
      }
      window.setTimeout(() => {
        skipScrollSpyRef.current = false;
      }, 850);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated || categories.length === 0) return;

    let ticking = false;

    const onScroll = () => {
      if (skipScrollSpyRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const sticky = stickyRef.current;
        if (!sticky) return;
        const line = sticky.getBoundingClientRect().bottom + 4;
        let current = categories[0]?.id;
        for (const c of categories) {
          const sec = document.getElementById(`menu-cat-${c.id}`);
          if (!sec) continue;
          const top = sec.getBoundingClientRect().top;
          if (top <= line) current = c.id;
        }
        if (current) {
          setActiveCategoryId((prev) =>
            prev === current ? prev : current!,
          );
        }
      });
    };

    const root = getAppScrollRoot();
    const target: HTMLElement | Window = root ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [isHydrated, categories]);

  const closeDishDrawer = useCallback(() => {
    router.replace(MENU_BASE, { scroll: false });
  }, [router]);

  const openCreateDrawer = useCallback(() => {
    router.push(`${MENU_BASE}?new=1`, { scroll: false });
  }, [router]);

  const openEditDrawer = useCallback(
    (id: string) => {
      router.push(
        `${MENU_BASE}?dish=${encodeURIComponent(id)}`,
        { scroll: false },
      );
    },
    [router],
  );

  const handleDishDrawerOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeDishDrawer();
    },
    [closeDishDrawer],
  );

  const filterActiveCount = useMemo(() => {
    let n = 0;
    if (dietFilter !== "all") n++;
    if (priceRange[0] > 0 || priceRange[1] < priceSliderMax) n++;
    return n;
  }, [dietFilter, priceRange, priceSliderMax]);

  const handleCategorySave = async (
    payload:
      | { name: string; active?: boolean }
      | { id: string; name: string; active: boolean },
  ) => {
    if ("id" in payload && payload.id) {
      updateCategory(payload.id, {
        name: payload.name,
        active: payload.active,
      });
    } else {
      const created = await addCategory(payload.name, payload.active !== false);
      if (created) {
        scrollToCategory(created.id);
      }
    }
  };

  const handleTaxonomySave = useCallback(
    async (
      payload:
        | { name: string; active?: boolean; backgroundColor: string }
        | { id: string; name: string; active: boolean; backgroundColor: string },
    ) => {
      if (!taxonomySheet) return;
      const store =
        taxonomySheet.group === "tags" ? menuTags : menuAllergens;
      if ("id" in payload && payload.id) {
        store.update(payload.id, {
          name: payload.name,
          active: payload.active,
          backgroundColor: payload.backgroundColor,
        });
      } else {
        await store.add(
          payload.name,
          payload.active !== false,
          payload.backgroundColor,
        );
      }
    },
    [taxonomySheet, menuTags, menuAllergens],
  );

  const showCards = !viewReady || viewMode === "cards";

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Speisekarte" />;
  }

  return (
    <>
      {!isHydrated ? (
        <MenuOverviewSkeleton />
      ) : (
        <div className="w-full pb-16">
        <div className="-mx-4 mb-3 flex flex-wrap gap-2 px-4 sm:-mx-6 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={moduleManageChipButtonClassName}
            onClick={() => setTaxonomyManage("tags")}
          >
            <Tags className="size-4" />
            Tags
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={moduleManageChipButtonClassName}
            onClick={() => setTaxonomyManage("allergens")}
          >
            <TriangleAlert className="size-4" />
            Allergene
          </Button>
        </div>

        <div className="-mx-4 mb-3 flex items-center justify-between px-4 sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/35 p-1">
            <Button
              type="button"
              variant={showCards ? "secondary" : "ghost"}
              size="icon-sm"
              className="rounded-full"
              aria-pressed={showCards}
              aria-label="Karten mit Bild"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              type="button"
              variant={!showCards ? "secondary" : "ghost"}
              size="icon-sm"
              className="rounded-full"
              aria-pressed={!showCards}
              aria-label="Kompakte Tabelle"
              onClick={() => setViewMode("compact")}
            >
              <Table2 className="size-4" />
            </Button>
          </div>
          <div className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full border-border/60"
              aria-label="Filter"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="size-4" />
            </Button>
            {filterActiveCount > 0 ? (
              <Badge
                variant="secondary"
                className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums"
              >
                {filterActiveCount}
              </Badge>
            ) : null}
          </div>
        </div>

        <div
          ref={stickyRef}
          style={{
            top: 0,
          }}
          className={cn(
            "sticky z-[15] -mx-4 border-b border-border/40 bg-background/90 px-4 py-3 shadow-none backdrop-blur-md dark:shadow-sm sm:-mx-6 sm:px-6",
          )}
        >
          <div className="space-y-3">
            <MenuSearchFilters
              search={search}
              onSearchChange={setSearch}
            />
            {search.trim() ? (
              <p className="text-xs text-muted-foreground">
                Suche in Gericht, Beschreibung und{" "}
                <span className="font-medium text-foreground">Rezept-Zutaten</span>{" "}
                (ca. 80% Übereinstimmung).
              </p>
            ) : null}
            <MenuCategoryTabs
              categories={categories}
              activeCategoryId={activeCategoryId}
              onCategorySelect={scrollToCategory}
              onNewCategory={() => setCategorySheet({ mode: "create" })}
              onEditCategory={(cat) =>
                setCategorySheet({ mode: "edit", cat })
              }
              onOpenManageCategories={() => setManageCategoriesOpen(true)}
            />
          </div>
        </div>

        <div className="mb-6 mt-5">
          <ListRangeCount
            className="mb-3"
            shown={visibleItemCount}
            total={items.length}
            itemLabel="Artikel"
          />
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={openCreateDrawer}
          >
            <Plus className="size-4" />
            Gericht hinzufügen
          </Button>
        </div>

        <div className="space-y-12">
          {items.length > 0 &&
            sections.map(({ cat, items: secItems }) => {
              const catIndex = categories.findIndex((c) => c.id === cat.id);
              const pos = catIndex >= 0 ? catIndex + 1 : 0;
              return (
                <section
                  key={cat.id}
                  id={`menu-cat-${cat.id}`}
                  aria-labelledby={`menu-cat-heading-${cat.id}`}
                >
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <h2
                      id={`menu-cat-heading-${cat.id}`}
                      className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl"
                    >
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {pos}
                      </span>
                      <span>{cat.name}</span>
                      {!isCategoryActive(cat) && (
                        <Badge variant="secondary" className="font-normal">
                          Inaktiv
                        </Badge>
                      )}
                    </h2>
                  </div>
                  {secItems.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      {hasNonDefaultFilters
                        ? "In dieser Kategorie keine Treffer – Filter oder Suche anpassen."
                        : "Noch keine Gerichte in dieser Kategorie."}
                    </p>
                  ) : showCards ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {secItems.map((item) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          tagDefinitions={mergedTagDefinitions}
                          currencyCode={currencyCode}
                          onSelect={() => openEditDrawer(item.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <MenuCompactItemsTable
                      items={secItems}
                      tagDefinitions={mergedTagDefinitions}
                      currencyCode={currencyCode}
                      sortable={!hasNonDefaultFilters}
                      onReorder={(ids) =>
                        reorderItemsInCategory(cat.id, ids)
                      }
                      onSelect={openEditDrawer}
                    />
                  )}
                </section>
              );
            })}
        </div>

        {items.length === 0 && (
          <Card className="mt-2 border-dashed border-border/60 bg-muted/30 shadow-none">
            <CardHeader className="items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <UtensilsCrossed className="size-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg">Noch keine Gerichte</CardTitle>
              <CardDescription className="max-w-xs text-base">
                Lege Kategorien und Gerichte an, um deine Karte zu füllen.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pb-8">
              <Button
                type="button"
                size="lg"
                className={modulePrimaryAddButtonFullWidthClassName}
                onClick={openCreateDrawer}
              >
                <Plus className="size-4" />
                Gericht hinzufügen
              </Button>
            </CardFooter>
          </Card>
        )}

        {items.length > 0 &&
          hasNonDefaultFilters &&
          !anyFilteredMatch && (
            <Card className="mt-10 border-dashed border-border/60 bg-muted/30 shadow-none">
              <CardHeader className="items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                  <UtensilsCrossed className="size-7 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">Keine Gerichte</CardTitle>
                <CardDescription className="max-w-xs text-base">
                  Passe Filter oder Suche an – für diese Einstellungen gibt es
                  keine Treffer.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pb-8">
                <Button
                  type="button"
                  size="lg"
                  className={modulePrimaryAddButtonFullWidthClassName}
                  onClick={openCreateDrawer}
                >
                  <Plus className="size-4" />
                  Gericht hinzufügen
                </Button>
              </CardFooter>
            </Card>
          )}
      </div>
      )}

      <DishDrawer
        open={drawerOpen && (drawerMode === "create" || !!editItem)}
        onOpenChange={handleDishDrawerOpenChange}
        mode={drawerMode}
        editItem={editItem}
        onCreate={async (item) => (await addItem(item)) != null}
        onUpdate={updateItem}
        onDelete={deleteItem}
        categories={categories}
      />

      <FilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        dietOptions={dietFilterOptions}
        dietFilter={dietFilter}
        onDietFilterChange={setDietFilter}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        priceMax={priceSliderMax}
        currencyCode={currencyCode}
      />

      <CategoryDrawer
        open={categorySheet !== null}
        onOpenChange={(o) => {
          if (!o) setCategorySheet(null);
        }}
        mode={categorySheet?.mode ?? "create"}
        initial={categorySheet?.mode === "edit" ? categorySheet.cat : null}
        onSave={handleCategorySave}
        onDelete={
          categorySheet?.mode === "edit"
            ? (id) => void deleteCategory(id)
            : undefined
        }
      />

      <CategoriesManageDrawer
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        categories={categories}
        onReorder={reorderCategories}
        onEdit={(cat) => setCategorySheet({ mode: "edit", cat })}
        onNew={() => setCategorySheet({ mode: "create" })}
      />

      <CategoriesManageDrawer
        open={taxonomyManage !== null}
        onOpenChange={(o) => {
          if (!o) setTaxonomyManage(null);
        }}
        categories={
          taxonomyManage === "tags"
            ? menuTags.items
            : taxonomyManage === "allergens"
              ? menuAllergens.items
              : []
        }
        onReorder={(next) => {
          if (!taxonomyManage) return;
          const store =
            taxonomyManage === "tags" ? menuTags : menuAllergens;
          store.reorder(next as MenuTaxonomyDefinition[]);
        }}
        onEdit={(row) => {
          if (!taxonomyManage) return;
          const store =
            taxonomyManage === "tags" ? menuTags : menuAllergens;
          const full = store.getById(row.id);
          if (full) {
            setTaxonomySheet({
              group: taxonomyManage,
              mode: "edit",
              initial: full,
            });
          }
          setTaxonomyManage(null);
        }}
        onNew={() => {
          if (!taxonomyManage) return;
          setTaxonomySheet({ group: taxonomyManage, mode: "create" });
          setTaxonomyManage(null);
        }}
        copy={
          taxonomyManage === "allergens"
            ? {
                title: "Allergene",
                description:
                  "Reihenfolge per Ziehen ändern (wie im Bestand). Inaktive Allergene stehen in Gerichten und Filtern nicht zur Verfügung.",
                newButton: "Neues Allergen",
              }
            : taxonomyManage === "tags"
              ? {
                  title: "Tags",
                  description:
                    "Reihenfolge per Ziehen ändern (wie im Bestand). Inaktive Tags stehen in Gerichten und Filtern nicht zur Verfügung.",
                  newButton: "Neues Tag",
                }
              : undefined
        }
        rowLeading={(row) => {
          const def =
            taxonomyManage === "tags"
              ? menuTags.getById(row.id)
              : taxonomyManage === "allergens"
                ? menuAllergens.getById(row.id)
                : undefined;
          const bg = def?.backgroundColor;
          if (!bg || !/^#[0-9A-Fa-f]{6}$/.test(bg)) return null;
          return (
            <span
              className="size-3 shrink-0 rounded-full border border-border/50 shadow-inner"
              style={{ backgroundColor: bg }}
              aria-hidden
            />
          );
        }}
      />

      <MenuTaxonomyDrawer
        open={taxonomySheet !== null}
        onOpenChange={(o) => {
          if (!o) setTaxonomySheet(null);
        }}
        mode={taxonomySheet?.mode ?? "create"}
        initial={
          taxonomySheet?.mode === "edit" ? taxonomySheet.initial : null
        }
        variant={
          taxonomySheet?.group === "allergens" ? "allergens" : "tags"
        }
        onSave={handleTaxonomySave}
        onDelete={
          taxonomySheet?.mode === "edit"
            ? (id) => {
                const store =
                  taxonomySheet.group === "tags" ? menuTags : menuAllergens;
                void store.remove(id);
              }
            : undefined
        }
      />
    </>
  );
}
