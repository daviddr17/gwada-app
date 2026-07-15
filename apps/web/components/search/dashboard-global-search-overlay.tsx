"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Contact,
  FileText,
  ImageIcon,
  MessageSquareQuote,
  Newspaper,
  Package,
  Receipt,
  Search,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { AppMobileChromeScreen } from "@/components/layout/app-mobile-chrome-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardGlobalSearch } from "@/lib/contexts/dashboard-global-search-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import type {
  DashboardGlobalSearchCategory,
  DashboardGlobalSearchGroup,
  DashboardGlobalSearchResponse,
  DashboardGlobalSearchResultItem,
} from "@/lib/types/dashboard-global-search";
import { DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH } from "@/lib/types/dashboard-global-search";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

const CATEGORY_ICONS: Record<DashboardGlobalSearchCategory, typeof Search> = {
  menu: UtensilsCrossed,
  reservations: CalendarDays,
  contacts: Contact,
  reviews: Star,
  staff: Users,
  inventory: Package,
  documents: FileText,
  news: Newspaper,
  events: Sparkles,
  accounting: Receipt,
  gallery: ImageIcon,
  staff_todos: ClipboardList,
};

function resultKey(item: DashboardGlobalSearchResultItem): string {
  return `${item.category}:${item.id}`;
}

function flattenGroups(groups: DashboardGlobalSearchGroup[]): DashboardGlobalSearchResultItem[] {
  return groups.flatMap((group) => group.items);
}

function DashboardGlobalSearchSkeleton() {
  return (
    <div className="space-y-6 px-2 py-1">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <Skeleton key={rowIndex} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardGlobalSearchOverlay() {
  const router = useRouter();
  const { open, closeSearch } = useDashboardGlobalSearch();
  const isMobile = useIsMobile();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [presented, setPresented] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<DashboardGlobalSearchGroup[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const showSkeleton = useDeferredSkeleton(loading);

  const flatItems = useMemo(() => flattenGroups(groups), [groups]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setPresented(true);
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    setPresented(false);
    setQuery("");
    setDebouncedQuery("");
    setGroups([]);
    setError(null);
    setActiveKey(null);
    setLoading(false);
    abortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open || !workspaceReady || !restaurantId) return;

    if (debouncedQuery.length < DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setLoading(false);
      setError(null);
      setGroups([]);
      setActiveKey(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const url = new URL("/api/dashboard/search", window.location.origin);
    url.searchParams.set("restaurantId", restaurantId);
    url.searchParams.set("q", debouncedQuery);

    void fetch(url.toString(), { signal: controller.signal })
      .then(async (res) => {
        const payload = (await res.json()) as {
          data?: DashboardGlobalSearchResponse;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(payload.error ?? "search_failed");
        }
        return payload.data ?? { query: debouncedQuery, groups: [] };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setGroups(data.groups);
        const first = flattenGroups(data.groups)[0];
        setActiveKey(first ? resultKey(first) : null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setGroups([]);
        setActiveKey(null);
        setError(e instanceof Error ? e.message : "search_failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [open, workspaceReady, restaurantId, debouncedQuery]);

  const navigateTo = useCallback(
    (item: DashboardGlobalSearchResultItem) => {
      closeSearch();
      router.push(item.href);
    },
    [closeSearch, router],
  );

  const moveSelection = useCallback(
    (delta: number) => {
      if (flatItems.length === 0) return;
      const currentIndex = activeKey
        ? flatItems.findIndex((item) => resultKey(item) === activeKey)
        : -1;
      const nextIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : flatItems.length - 1
          : (currentIndex + delta + flatItems.length) % flatItems.length;
      const nextItem = flatItems[nextIndex];
      if (!nextItem) return;
      const key = resultKey(nextItem);
      setActiveKey(key);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-search-result-key="${key}"]`)
        ?.scrollIntoView({ block: "nearest" });
    },
    [activeKey, flatItems],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      if (event.key === "Enter") {
        const item = flatItems.find((entry) => resultKey(entry) === activeKey);
        if (item) {
          event.preventDefault();
          navigateTo(item);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeSearch, moveSelection, navigateTo, flatItems, activeKey]);


  const trimmedQuery = query.trim();
  const showMinCharsHint =
    trimmedQuery.length > 0 &&
    trimmedQuery.length < DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH;
  const showEmpty =
    !loading &&
    !error &&
    debouncedQuery.length >= DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH &&
    groups.length === 0;

  const results = (
    <>
      {!workspaceReady || !restaurantId ? (
        <DashboardGlobalSearchSkeleton />
      ) : showMinCharsHint ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
          <BookOpen className="mb-3 size-8 text-muted-foreground/70" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Mindestens {DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH} Zeichen eingeben
          </p>
        </div>
      ) : trimmedQuery.length === 0 ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
          <Search className="mb-3 size-8 text-muted-foreground/70" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            Alles durchsuchen
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Speisekarte, Reservierungen, Kontakte, Bewertungen, Bestand und mehr —
            je nach Berechtigung.
          </p>
        </div>
      ) : showSkeleton ? (
        <DashboardGlobalSearchSkeleton />
      ) : error ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
          <MessageSquareQuote
            className="mb-3 size-8 text-muted-foreground/70"
            aria-hidden
          />
          <p className="text-sm text-destructive">Suche fehlgeschlagen</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      ) : showEmpty ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
          <Search className="mb-3 size-8 text-muted-foreground/70" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Keine Treffer für „{debouncedQuery}“
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {groups.map((group) => {
            const Icon = CATEGORY_ICONS[group.category];
            return (
              <section key={group.category} aria-label={group.label}>
                <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
                  <Icon className="size-3.5" aria-hidden />
                  {group.label}
                </div>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const key = resultKey(item);
                    const active = activeKey === key;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          data-search-result-key={key}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                            active
                              ? "border-accent/30 bg-accent/8"
                              : "border-transparent hover:border-border/50 hover:bg-muted/40",
                          )}
                          onMouseEnter={() => setActiveKey(key)}
                          onClick={() => navigateTo(item)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card/80",
                              active && "border-accent/30 bg-accent/10",
                            )}
                          >
                            <Icon className="size-4 text-muted-foreground" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {item.title}
                            </span>
                            {item.subtitle ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );

  const searchField = (
    <div className="flex shrink-0 items-center gap-3 px-4 py-3">
      <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Gerichte, Reservierungen, Kontakte, Mitarbeiter …"
        className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );

  if (isMobile) {
    return (
      <AppMobileChromeScreen
        open={open}
        onClose={closeSearch}
        title="Suche"
        aria-label="Globale Suche"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border/50">{searchField}</div>
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {results}
          </div>
        </div>
      </AppMobileChromeScreen>
    );
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4 sm:p-5",
        presented ? "opacity-100" : "opacity-0",
      )}
      style={{ zIndex: APP_LAYER_Z_INDEX.stackedSurface }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-xl motion-reduce:backdrop-blur-sm"
        aria-label="Suche schließen"
        onClick={closeSearch}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Globale Suche"
        className={cn(
          "relative flex h-[90vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-backdrop-filter:bg-background/85",
          "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
          presented ? "scale-100 opacity-100" : "scale-[0.98] opacity-0",
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-4 sm:px-5">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gerichte, Reservierungen, Kontakte, Mitarbeiter …"
            className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full"
            aria-label="Schließen"
            onClick={closeSearch}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
        >
          {results}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/50 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
                ↑
              </kbd>
              <kbd className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
                ↓
              </kbd>
              <span>Navigieren</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
                ↵
              </kbd>
              <span>Öffnen</span>
            </span>
          </div>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <kbd className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
              esc
            </kbd>
            <span>Schließen</span>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
