"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedMenuCategoryTabs } from "@/components/embed/embed-menu-category-tabs";
import { EmbedMenuMainCategoryTabs } from "@/components/embed/embed-menu-main-category-tabs";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { MenuSearchFilters } from "@/components/menu/menu-search-filters";
import type { AppLocale } from "@/i18n/config";
import type { GwadaEmbedFrameViewportMessage } from "@/lib/embed/embed-protocol";
import {
  findProfileScrollRootContaining,
  isGwadaEmbedHostMode,
  offsetTopInEmbedDocument,
  postEmbedScrollToHost,
  postEmbedToolbarPinState,
  readGwadaEmbedId,
  scrollToMenuCategoryInContainer,
  scrollToMenuCategoryInPage,
  subscribeEmbedHostViewport,
  profileSheetMenuStickyScrollOffset,
} from "@/lib/embed/embed-menu-scroll";
import {
  activeCategoryForSpyLine,
  applyEmbedMenuToolbarPinStyles,
  computeEmbedMenuToolbarPin,
  normalizeHostViewport,
  resetEmbedMenuToolbarPinStyles,
} from "@/lib/embed/embed-menu-toolbar-pin";
import { labelForTagId } from "@/lib/constants/menu-labels";
import { sortItemsInCategoryForDisplay } from "@/lib/menu/item-utils";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuMainCategoryDefinition,
  MenuOptionGroup,
  MenuTaxonomyDefinition,
} from "@/lib/types/menu";
import { getTagChipVisual } from "@/lib/utils/tag-styles";
import { fuzzyTextMatchesQuery } from "@/lib/utils/fuzzy-search";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import {
  PublicMenuItemOptionsDisplay,
  resolveMenuItemOptionGroups,
} from "@/components/menu/public-menu-item-options-display";
import { cn } from "@/lib/utils";

export type EmbedMenuWidgetProps = {
  restaurantName: string;
  accentHex: string;
  currencyCode?: string;
  mainCategories: MenuMainCategoryDefinition[];
  categories: MenuCategoryDefinition[];
  items: MenuItem[];
  tagDefinitions: readonly MenuTaxonomyDefinition[];
  /** Optionsgruppen (Beilagen/Extras) — öffentlich ausgeschrieben; Auswahl nur Ordering/POS. */
  optionGroups?: readonly MenuOptionGroup[];
  /** Profil-Sheet: kein Embed-Header, Sticky/Scroll am Sheet-Viewport. */
  variant?: "embed" | "profileSheet";
  textTheme?: EmbedTextTheme;
  sourceLocale?: AppLocale;
};

function EmbedMenuItemRow({
  item,
  tagDefinitions,
  currencyCode,
  optionGroupsById,
}: {
  item: MenuItem;
  tagDefinitions: readonly MenuTaxonomyDefinition[];
  currencyCode?: string;
  optionGroupsById: ReadonlyMap<string, MenuOptionGroup>;
}) {
  const itemOptionGroups = resolveMenuItemOptionGroups(
    item.optionGroupIds,
    optionGroupsById,
  );

  return (
    <article className="border-b border-border/40 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3
            className="text-base font-semibold leading-snug tracking-tight"
            data-embed-mt
          >
            {item.name}
          </h3>
          {item.description ? (
            <p
              className="mt-1 text-sm leading-relaxed text-muted-foreground"
              data-embed-mt
            >
              {item.description}
            </p>
          ) : null}
          {itemOptionGroups.length > 0 ? (
            <PublicMenuItemOptionsDisplay
              groups={itemOptionGroups}
              currencyCode={currencyCode}
            />
          ) : null}
          {item.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => {
                const vis = getTagChipVisual(tag, tagDefinitions);
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      "h-6 rounded-full border px-2.5 text-[0.6875rem] font-medium",
                      vis.className,
                    )}
                    style={vis.style}
                  >
                    {labelForTagId(tag, tagDefinitions)}
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </div>
        <p className="shrink-0 text-base font-semibold tabular-nums text-accent">
          {formatMenuPrice(item.price, currencyCode)}
        </p>
      </div>
    </article>
  );
}

function EmbedMenuToolbar({
  outerRef,
  toolbarRef,
  sticky,
  hostMode,
  profileSheet,
  search,
  onSearchChange,
  hasSearch,
  visibleMainCategories,
  activeMainCategoryId,
  onMainCategorySelect,
  mainCategoryVariant,
  visibleCategories,
  activeCategoryId,
  onCategorySelect,
}: {
  outerRef?: RefObject<HTMLDivElement | null>;
  toolbarRef: RefObject<HTMLDivElement | null>;
  sticky?: boolean;
  hostMode?: boolean;
  profileSheet?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  hasSearch: boolean;
  visibleMainCategories: MenuMainCategoryDefinition[];
  activeMainCategoryId: string;
  onMainCategorySelect: (id: string) => void;
  mainCategoryVariant?: "default" | "sliding";
  visibleCategories: MenuCategoryDefinition[];
  activeCategoryId: string;
  onCategorySelect: (id: string) => void;
}) {
  return (
    <div
      ref={outerRef}
      className={cn(
        sticky && "sticky z-20",
        sticky && !profileSheet && "top-0",
        profileSheet &&
          "top-[var(--profile-sheet-module-title-h,0px)]",
        profileSheet &&
          "z-30 -mx-4 border-b border-border/40 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/80 sm:-mx-5",
      )}
    >
      <div
        className={cn(
          profileSheet ? "w-full min-w-0 px-4 sm:px-5" : "w-full min-w-0 px-4 sm:px-6",
        )}
      >
        <div
          ref={toolbarRef}
          className={cn(
            "py-3",
            "shadow-none dark:shadow-sm",
            hostMode
              ? "border-b border-border/40 bg-background embed-menu-toolbar-pinned-inner"
              : profileSheet
                ? "bg-transparent"
                : "border-b border-border/40 bg-background/90 backdrop-blur-md",
          )}
        >
          <div className="space-y-3">
            <MenuSearchFilters
              search={search}
              onSearchChange={onSearchChange}
              placeholder="Gerichte suchen"
            />
            {hasSearch ? (
              <p className="text-xs text-muted-foreground">
                Suche in Gericht und Beschreibung (ca. 80&nbsp;% Übereinstimmung).
              </p>
            ) : null}
            <EmbedMenuMainCategoryTabs
              mainCategories={visibleMainCategories}
              activeMainCategoryId={activeMainCategoryId}
              onMainCategorySelect={onMainCategorySelect}
              variant={mainCategoryVariant}
            />
            <EmbedMenuCategoryTabs
              categories={visibleCategories}
              activeCategoryId={activeCategoryId}
              onCategorySelect={onCategorySelect}
              variant={profileSheet ? "sliding" : "default"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbedMenuSections({
  sections,
  visibleCategories,
  hasSearch,
  anyFilteredMatch,
  tagDefinitions,
  currencyCode,
  optionGroupsById,
}: {
  sections: { cat: MenuCategoryDefinition; items: MenuItem[] }[];
  visibleCategories: MenuCategoryDefinition[];
  hasSearch: boolean;
  anyFilteredMatch: boolean;
  tagDefinitions: readonly MenuTaxonomyDefinition[];
  currencyCode?: string;
  optionGroupsById: ReadonlyMap<string, MenuOptionGroup>;
}) {
  if (hasSearch && !anyFilteredMatch) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <UtensilsCrossed
            className="size-6 text-muted-foreground"
            aria-hidden
          />
        </div>
        <p className="text-sm font-medium">Keine Treffer</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Passe die Suche an — für diesen Begriff gibt es keine Gerichte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-8 pt-6">
      {sections.map(({ cat, items: secItems }) => {
        const catIndex = visibleCategories.findIndex((c) => c.id === cat.id);
        const pos = catIndex >= 0 ? catIndex + 1 : 0;
        return (
          <section
            key={cat.id}
            id={`menu-cat-${cat.id}`}
            aria-labelledby={`menu-cat-heading-${cat.id}`}
          >
            <h2
              id={`menu-cat-heading-${cat.id}`}
              className="mb-3 flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl"
            >
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {pos}
              </span>
              <span data-embed-mt>{cat.name}</span>
            </h2>
            {secItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                {hasSearch
                  ? "In dieser Kategorie keine Treffer — Suche anpassen."
                  : "Keine Gerichte in dieser Kategorie."}
              </p>
            ) : (
              <div>
                {secItems.map((item) => (
                  <EmbedMenuItemRow
                    key={item.id}
                    item={item}
                    tagDefinitions={tagDefinitions}
                    currencyCode={currencyCode}
                    optionGroupsById={optionGroupsById}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function EmbedMenuWidget({
  restaurantName,
  accentHex,
  currencyCode,
  mainCategories,
  categories,
  items,
  tagDefinitions,
  optionGroups = [],
  variant = "embed",
  textTheme = "dark",
  sourceLocale = "de",
}: EmbedMenuWidgetProps) {
  const [hostMode, setHostMode] = useState(false);
  const [embedId, setEmbedId] = useState<string | null>(null);
  const widgetRootRef = useRef<HTMLDivElement>(null);
  const [profileScrollRoot, setProfileScrollRoot] = useState<HTMLElement | null>(
    null,
  );

  const optionGroupsById = useMemo(() => {
    const map = new Map<string, MenuOptionGroup>();
    for (const group of optionGroups) {
      if (group.active === false) continue;
      map.set(group.id, group);
    }
    return map;
  }, [optionGroups]);

  useEffect(() => {
    setHostMode(isGwadaEmbedHostMode());
    setEmbedId(readGwadaEmbedId());
  }, []);

  useLayoutEffect(() => {
    setProfileScrollRoot(
      findProfileScrollRootContaining(widgetRootRef.current),
    );
  }, [variant]);

  const profileSheet = variant === "profileSheet" || profileScrollRoot !== null;

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);

  const visibleCategoriesAll = useMemo(
    () =>
      categories.filter(
        (cat) =>
          cat.active !== false &&
          (itemsByCategory.get(cat.id)?.length ?? 0) > 0,
      ),
    [categories, itemsByCategory],
  );

  const visibleMainCategories = useMemo(() => {
    const mainIdsWithItems = new Set(
      visibleCategoriesAll.map((c) => c.mainCategoryId),
    );
    return mainCategories.filter(
      (m) => m.active !== false && mainIdsWithItems.has(m.id),
    );
  }, [mainCategories, visibleCategoriesAll]);

  const [activeMainCategoryId, setActiveMainCategoryId] = useState(
    () => visibleMainCategories[0]?.id ?? "",
  );

  const visibleCategories = useMemo(
    () =>
      visibleCategoriesAll.filter(
        (cat) => cat.mainCategoryId === activeMainCategoryId,
      ),
    [visibleCategoriesAll, activeMainCategoryId],
  );

  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(
    () => visibleCategories[0]?.id ?? "",
  );
  const [toolbarPinned, setToolbarPinned] = useState(false);
  const [toolbarHeight, setToolbarHeight] = useState(0);

  const hostViewportRef = useRef<GwadaEmbedFrameViewportMessage | null>(null);
  const frozenPinTopRef = useRef<number | null>(null);
  const toolbarOuterRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarSentinelRef = useRef<HTMLDivElement>(null);
  const toolbarPinnedRef = useRef(false);
  const toolbarHeightRef = useRef(0);
  const skipScrollSpyRef = useRef(false);
  const visibleCategoriesRef = useRef(visibleCategories);

  useEffect(() => {
    visibleCategoriesRef.current = visibleCategories;
  }, [visibleCategories]);

  useEffect(() => {
    toolbarHeightRef.current = toolbarHeight;
  }, [toolbarHeight]);

  const runHostPinUpdate = useCallback(() => {
    const vp = hostViewportRef.current;
    const sentinel = toolbarSentinelRef.current;
    if (!hostMode || !embedId || !vp || !sentinel) return;

    const h = toolbarHeightRef.current || toolbarRef.current?.offsetHeight || 0;
    const pin = computeEmbedMenuToolbarPin(
      vp,
      sentinel,
      h,
      toolbarPinnedRef.current,
      frozenPinTopRef.current,
    );

    frozenPinTopRef.current = pin.pinned ? pin.frozenPinTop : null;

    applyEmbedMenuToolbarPinStyles(
      toolbarOuterRef.current,
      toolbarRef.current,
      pin,
    );

    if (pin.pinned !== toolbarPinnedRef.current) {
      toolbarPinnedRef.current = pin.pinned;
      setToolbarPinned(pin.pinned);
      postEmbedToolbarPinState(embedId, pin.pinned);
    }

    if (skipScrollSpyRef.current) return;

    const current = activeCategoryForSpyLine(
      visibleCategoriesRef.current,
      pin.spyLine,
      (id) => {
        const el = document.getElementById(`menu-cat-${id}`);
        if (!el) return Number.POSITIVE_INFINITY;
        return vp.top + offsetTopInEmbedDocument(el);
      },
    );
    if (current) {
      setActiveCategoryId((prev) => (prev === current ? prev : current));
    }
  }, [hostMode, embedId]);

  useEffect(() => {
    if (!embedId) return;
    return subscribeEmbedHostViewport(embedId, (raw) => {
      hostViewportRef.current = normalizeHostViewport(raw);
      runHostPinUpdate();
    });
  }, [embedId, runHostPinUpdate]);

  useEffect(() => {
    return () => {
      if (embedId && hostMode) {
        postEmbedToolbarPinState(embedId, false);
      }
      resetEmbedMenuToolbarPinStyles(
        toolbarOuterRef.current,
        toolbarRef.current,
      );
    };
  }, [embedId, hostMode]);

  useEffect(() => {
    if (
      visibleMainCategories.length > 0 &&
      !visibleMainCategories.some((m) => m.id === activeMainCategoryId)
    ) {
      setActiveMainCategoryId(visibleMainCategories[0]!.id);
    }
  }, [visibleMainCategories, activeMainCategoryId]);

  useEffect(() => {
    if (
      visibleCategories.length > 0 &&
      !visibleCategories.some((c) => c.id === activeCategoryId)
    ) {
      setActiveCategoryId(visibleCategories[0]!.id);
    }
  }, [visibleCategories, activeCategoryId]);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setToolbarHeight(el.offsetHeight);
    });
    ro.observe(el);
    setToolbarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [visibleCategories.length, search]);

  const passItemFilters = useCallback(
    (item: MenuItem) => {
      const q = search.trim();
      if (!q) return true;
      return (
        fuzzyTextMatchesQuery(item.name, q) ||
        fuzzyTextMatchesQuery(item.description, q)
      );
    },
    [search],
  );

  const sections = useMemo(() => {
    return visibleCategories.map((cat) => ({
      cat,
      items: sortItemsInCategoryForDisplay(
        (itemsByCategory.get(cat.id) ?? []).filter(passItemFilters),
      ),
    }));
  }, [visibleCategories, itemsByCategory, passItemFilters]);

  const hasSearch = search.trim().length > 0;
  const anyFilteredMatch = sections.some((s) => s.items.length > 0);

  useEffect(() => {
    if (!hasSearch) return;
    const mine =
      sections.find((s) => s.cat.id === activeCategoryId)?.items.length ?? 0;
    if (mine > 0) return;
    const first = sections.find((s) => s.items.length > 0);
    if (first) setActiveCategoryId(first.cat.id);
  }, [hasSearch, sections, activeCategoryId]);

  const updateScrollSpy = useCallback(() => {
    if (skipScrollSpyRef.current) return;
    if (hostMode && embedId) return;

    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const line = toolbar.getBoundingClientRect().bottom + 4;
    let current = visibleCategories[0]?.id;
    for (const c of visibleCategories) {
      const sec = document.getElementById(`menu-cat-${c.id}`);
      if (!sec) continue;
      if (sec.getBoundingClientRect().top <= line) current = c.id;
    }
    if (current) {
      setActiveCategoryId((prev) => (prev === current ? prev : current!));
    }
  }, [visibleCategories, hostMode, embedId]);

  useEffect(() => {
    if (hostMode && embedId) return;

    let ticking = false;
    const onScroll = () => {
      if (skipScrollSpyRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateScrollSpy();
      });
    };

    const profileRoot = profileScrollRoot;
    if (profileRoot) {
      profileRoot.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => profileRoot.removeEventListener("scroll", onScroll);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [hostMode, embedId, updateScrollSpy, profileScrollRoot]);

  const selectMainCategory = useCallback((id: string) => {
    skipScrollSpyRef.current = true;
    setActiveMainCategoryId(id);
    requestAnimationFrame(() => {
      const profileRoot = profileScrollRoot;
      if (profileRoot) {
        profileRoot.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      window.setTimeout(() => {
        skipScrollSpyRef.current = false;
      }, 850);
    });
  }, [profileScrollRoot]);

  const scrollToCategory = useCallback(
    (id: string) => {
      skipScrollSpyRef.current = true;
      setActiveCategoryId(id);
      requestAnimationFrame(() => {
        const stickyEl =
          toolbarOuterRef.current ?? toolbarRef.current;
        const toolbarH = stickyEl?.offsetHeight ?? 0;
        const profileRoot = profileScrollRoot;
        if (hostMode && embedId) {
          postEmbedScrollToHost(embedId, id, toolbarH);
        } else if (profileRoot) {
          scrollToMenuCategoryInContainer(
            profileRoot,
            id,
            profileSheetMenuStickyScrollOffset(profileRoot, toolbarH),
          );
        } else {
          scrollToMenuCategoryInPage(id, toolbarH);
        }
        window.setTimeout(() => {
          skipScrollSpyRef.current = false;
        }, 850);
      });
    },
    [hostMode, embedId, profileScrollRoot],
  );

  const resizeDeps = [
    restaurantName,
    visibleMainCategories.length,
    visibleCategories.length,
    items.length,
    search,
    anyFilteredMatch,
    toolbarPinned,
    toolbarHeight,
  ];

  const toolbarProps = {
    toolbarRef,
    search,
    onSearchChange: setSearch,
    hasSearch,
    visibleMainCategories,
    activeMainCategoryId,
    onMainCategorySelect: selectMainCategory,
    mainCategoryVariant: profileSheet ? ("sliding" as const) : ("default" as const),
    visibleCategories,
    activeCategoryId,
    onCategorySelect: scrollToCategory,
  };

  return (
    <EmbedAccentRoot
      accentHex={accentHex}
      textTheme={textTheme}
      brandFooter={variant !== "profileSheet"}
      sourceLocale={sourceLocale}
      showLocalePicker={variant === "embed"}
    >
      <EmbedResizeReporter deps={resizeDeps} widget="menu" />
      <div
        ref={widgetRootRef}
        data-gwada-embed-content
        className={cn(
          profileSheet ? "w-full min-w-0 pb-6" : "w-full min-w-0 py-6",
        )}
      >
        {visibleCategoriesAll.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aktuell sind keine Gerichte veröffentlicht.
          </p>
        ) : (
          <>
            <div ref={toolbarSentinelRef} className="h-0 w-full" aria-hidden />
            {hostMode && toolbarPinned && toolbarHeight > 0 ? (
              <div style={{ height: toolbarHeight }} aria-hidden />
            ) : null}
            <EmbedMenuToolbar
              {...toolbarProps}
              outerRef={hostMode || profileSheet ? toolbarOuterRef : undefined}
              sticky={!hostMode}
              hostMode={hostMode}
              profileSheet={profileSheet}
            />
            <div className={cn(profileSheet ? "px-4 sm:px-5" : "px-4 sm:px-6")}>
              <EmbedMenuSections
                sections={sections}
                visibleCategories={visibleCategories}
                hasSearch={hasSearch}
                anyFilteredMatch={anyFilteredMatch}
                tagDefinitions={tagDefinitions}
                currencyCode={currencyCode}
                optionGroupsById={optionGroupsById}
              />
            </div>
          </>
        )}
      </div>
    </EmbedAccentRoot>
  );
}
