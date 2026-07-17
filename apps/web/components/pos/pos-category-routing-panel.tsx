"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  DEFAULT_POS_ROUTE_DESTINATION,
  POS_ROUTE_DESTINATION_LABELS_DE,
  POS_ROUTE_DESTINATIONS,
  routeIncludesKds,
  routeIncludesPrinter,
  type PosRouteDestination,
} from "@gwada/pos-domain";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  moduleDataTableHeadRowClassName,
  moduleDataTableShellClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

type MenuCategory = { id: string; name: string };
type KdsDevice = { id: string; name: string };
type Printer = { id: string; name: string };
type RouteRow = {
  menuCategoryId: string;
  destination: PosRouteDestination;
  kdsDeviceIds: string[];
  printerIds: string[];
};

function emptyRoute(categoryId: string): RouteRow {
  return {
    menuCategoryId: categoryId,
    destination: DEFAULT_POS_ROUTE_DESTINATION,
    kdsDeviceIds: [],
    printerIds: [],
  };
}

function DeviceChipRow({
  items,
  selectedIds,
  emptyHint,
  onToggle,
}: {
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  emptyHint: string;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyHint}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const on = selectedIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-medium",
              on
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border/60 text-muted-foreground",
            )}
            onClick={() => onToggle(item.id)}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

export function PosCategoryRoutingPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [devices, setDevices] = useState<KdsDevice[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [routes, setRoutes] = useState<Record<string, RouteRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bootRes, routeRes, kdsRes, printerRes] = await Promise.all([
        fetch(
          `/api/pos/bootstrap?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/pos/category-routes?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/pos/kds/devices?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/pos/printers?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
      ]);
      const bootJson = (await bootRes.json()) as {
        menu?: { categories?: MenuCategory[] };
      };
      const routeJson = (await routeRes.json()) as {
        routes?: Array<{
          menuCategoryId: string;
          destination: PosRouteDestination;
          kdsDeviceIds: string[];
          printerIds: string[];
        }>;
      };
      const kdsJson = (await kdsRes.json()) as { devices?: KdsDevice[] };
      const printerJson = (await printerRes.json()) as {
        printers?: Printer[];
      };

      const cats = bootJson.menu?.categories ?? [];
      setCategories(cats);
      setDevices(kdsJson.devices ?? []);
      setPrinters(printerJson.printers ?? []);

      const map: Record<string, RouteRow> = {};
      for (const cat of cats) map[cat.id] = emptyRoute(cat.id);
      for (const r of routeJson.routes ?? []) {
        map[r.menuCategoryId] = {
          menuCategoryId: r.menuCategoryId,
          destination: r.destination,
          kdsDeviceIds: r.kdsDeviceIds ?? [],
          printerIds: r.printerIds ?? [],
        };
      }
      setRoutes(map);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRoute = (categoryId: string, patch: Partial<RouteRow>) => {
    setRoutes((prev) => ({
      ...prev,
      [categoryId]: { ...(prev[categoryId] ?? emptyRoute(categoryId)), ...patch },
    }));
  };

  const saveOne = async (categoryId: string) => {
    if (!restaurantId) return;
    const row = routes[categoryId] ?? emptyRoute(categoryId);
    setSavingId(categoryId);
    try {
      const res = await fetch("/api/pos/category-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          menuCategoryId: categoryId,
          destination: row.destination,
          kdsDeviceIds: routeIncludesKds(row.destination)
            ? row.kdsDeviceIds
            : [],
          printerIds: routeIncludesPrinter(row.destination)
            ? row.printerIds
            : [],
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Routing gespeichert");
    } finally {
      setSavingId(null);
    }
  };

  const toggleId = (
    categoryId: string,
    key: "kdsDeviceIds" | "printerIds",
    id: string,
  ) => {
    const row = routes[categoryId] ?? emptyRoute(categoryId);
    const list = row[key];
    const on = list.includes(id);
    patchRoute(categoryId, {
      [key]: on ? list.filter((x) => x !== id) : [...list, id],
    });
  };

  if (!ready || showSkeleton) {
    return <Skeleton className="mt-4 h-48 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Kategorie-Routing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pro Speisekarten-Kategorie: Küchen-Bon an KDS, Bondrucker, beides
          oder gar nicht. Ohne Eintrag gilt „Nur KDS“. Leer gelassene
          Geräte-/Drucker-Auswahl = alle aktiven.
        </p>

        {categories.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Keine Kategorien — zuerst in der Speisekarte anlegen.
          </p>
        ) : (
          <div className={moduleDataTableShellClassName}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowClassName}>
                    <th className="px-3 py-2.5 font-medium">Kategorie</th>
                    <th className="px-3 py-2.5 font-medium">Ziel</th>
                    <th className="px-3 py-2.5 font-medium">KDS</th>
                    <th className="px-3 py-2.5 font-medium">Drucker</th>
                    <th className="w-[7.5rem] px-3 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const row = routes[cat.id] ?? emptyRoute(cat.id);
                    const showKds = routeIncludesKds(row.destination);
                    const showPrinter = routeIncludesPrinter(row.destination);
                    return (
                      <tr
                        key={cat.id}
                        className="border-b border-border/40 last:border-b-0"
                      >
                        <td className="px-3 py-3 align-top font-medium">
                          {cat.name}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Select
                            value={row.destination}
                            onValueChange={(v) =>
                              patchRoute(cat.id, {
                                destination: (String(
                                  v ?? DEFAULT_POS_ROUTE_DESTINATION,
                                ) ||
                                  DEFAULT_POS_ROUTE_DESTINATION) as PosRouteDestination,
                              })
                            }
                          >
                            <SelectTrigger
                              className={appSelectTriggerAccentCn(
                                "h-9 w-full min-w-[9.5rem]",
                              )}
                            >
                              <SelectValue>
                                {
                                  POS_ROUTE_DESTINATION_LABELS_DE[
                                    row.destination
                                  ]
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {POS_ROUTE_DESTINATIONS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {POS_ROUTE_DESTINATION_LABELS_DE[d]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {showKds ? (
                            <DeviceChipRow
                              items={devices}
                              selectedIds={row.kdsDeviceIds}
                              emptyHint="Kein KDS-Gerät"
                              onToggle={(id) =>
                                toggleId(cat.id, "kdsDeviceIds", id)
                              }
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {showPrinter ? (
                            <DeviceChipRow
                              items={printers}
                              selectedIds={row.printerIds}
                              emptyHint="Kein Drucker"
                              onToggle={(id) =>
                                toggleId(cat.id, "printerIds", id)
                              }
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Button
                            type="button"
                            size="sm"
                            className={brandActionButtonRoundedClassName}
                            disabled={savingId === cat.id}
                            onClick={() => void saveOne(cat.id)}
                          >
                            Speichern
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
