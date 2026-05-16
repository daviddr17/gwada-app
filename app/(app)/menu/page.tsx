"use client";

import {
  Suspense,
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
  UtensilsCrossed,
} from "lucide-react";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { MenuCompactItemsTable } from "@/components/menu/menu-compact-items-table";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { DishDrawer } from "@/components/menu/dish-drawer";
import { FilterDrawer } from "@/components/menu/filter-drawer";
import { MenuCategoryTabs } from "@/components/menu/menu-category-tabs";
import { MenuItemCard } from "@/components/menu/menu-item-card";
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
import { useCategoriesStorage } from "@/lib/hooks/use-categories-storage";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
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
  PriceRange,
} from "@/lib/types/menu";
import { cn } from "@/lib/utils";
import { useMenuViewMode } from "@/hooks/use-menu-view-mode";

const APP_HEADER_PX = 56; /* h-14 */

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    categories,
    addCategory,
    updateCategory,
    reorderCategories,
    isHydrated: categoriesHydrated,
  } = useCategoriesStorage();
  const {
    items,
    addItem,
    updateItem,
    getItemById,
    reorderItemsInCategory,
    isHydrated: menuHydrated,
  } = useMenuStorage();

  const { ingredients, isHydrated: ingredientsHydrated } =
    useIngredientsStorage();

  const { mode: viewMode, setMode: setViewMode, ready: viewReady } =
    useMenuViewMode();

  const isHydrated = categoriesHydrated && menuHydrated && ingredientsHydrated;

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
      if (!el) {
        window.setTimeout(() => {
          skipScrollSpyRef.current = false;
        }, 100);
        return;
      }
      const stickyH = sticky?.offsetHeight ?? 0;
      const rect = el.getBoundingClientRect();
      const pad = 8;
      window.scrollTo({
        top:
          window.scrollY +
          rect.top -
          APP_HEADER_PX -
          stickyH -
          pad,
        behavior: "smooth",
      });
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
        const line = APP_HEADER_PX + sticky.offsetHeight + 4;
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

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHydrated, categories]);

  const closeDishDrawer = useCallback(() => {
    router.replace("/menu", { scroll: false });
  }, [router]);

  const openCreateDrawer = useCallback(() => {
    router.push("/menu?new=1", { scroll: false });
  }, [router]);

  const openEditDrawer = useCallback(
    (id: string) => {
      router.push(`/menu?dish=${encodeURIComponent(id)}`, { scroll: false });
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

  const handleCategorySave = (
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
      const created = addCategory(payload.name, payload.active !== false);
      if (created) {
        scrollToCategory(created.id);
      }
    }
  };

  const showCards = !viewReady || viewMode === "cards";

  return (
    <div className="bg-background">
      <main
        className={cn(
          "mx-auto max-w-3xl px-4 pb-16 pt-8 transition-opacity duration-300 sm:max-w-4xl sm:px-6",
          !isHydrated && "opacity-0",
          isHydrated && "opacity-100",
        )}
      >
        <header className="mb-6 space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Digitale Karte
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Speisekarte
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Caribbean & Soul-Food – kuratiert für deine Gäste.
          </p>
        </header>

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
          className={cn(
            "sticky top-14 z-20 -mx-4 border-b border-border/40 bg-background/90 px-4 py-3 shadow-sm backdrop-blur-md",
            "sm:-mx-6 sm:px-6",
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

        <div className="mb-6 mt-5 flex justify-end">
          <Button
            size="lg"
            className="h-12 gap-2 rounded-full bg-accent px-6 text-accent-foreground shadow-md hover:bg-accent/90 tap-scale"
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
                          onSelect={() => openEditDrawer(item.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <MenuCompactItemsTable
                      items={secItems}
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
            <CardFooter className="justify-center pb-8">
              <Button
                variant="outline"
                className="h-11 rounded-full tap-scale"
                onClick={openCreateDrawer}
              >
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
              <CardFooter className="justify-center pb-8">
                <Button
                  variant="outline"
                  className="h-11 rounded-full tap-scale"
                  onClick={openCreateDrawer}
                >
                  Gericht hinzufügen
                </Button>
              </CardFooter>
            </Card>
          )}
      </main>

      <DishDrawer
        open={drawerOpen && (drawerMode === "create" || !!editItem)}
        onOpenChange={handleDishDrawerOpenChange}
        mode={drawerMode}
        editItem={editItem}
        onCreate={(item) => addItem(item) != null}
        onUpdate={updateItem}
        categories={categories}
      />

      <FilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        dietFilter={dietFilter}
        onDietFilterChange={setDietFilter}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        priceMax={priceSliderMax}
      />

      <CategoryDrawer
        open={categorySheet !== null}
        onOpenChange={(o) => {
          if (!o) setCategorySheet(null);
        }}
        mode={categorySheet?.mode ?? "create"}
        initial={categorySheet?.mode === "edit" ? categorySheet.cat : null}
        onSave={handleCategorySave}
      />

      <CategoriesManageDrawer
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        categories={categories}
        onReorder={reorderCategories}
        onEdit={(cat) => setCategorySheet({ mode: "edit", cat })}
        onNew={() => setCategorySheet({ mode: "create" })}
      />
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="bg-background" />}>
      <MenuPageContent />
    </Suspense>
  );
}
