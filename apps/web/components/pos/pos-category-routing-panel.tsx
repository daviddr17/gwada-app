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
import { Label } from "@/components/ui/label";
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
          <ul className="space-y-4">
            {categories.map((cat) => {
              const row = routes[cat.id] ?? emptyRoute(cat.id);
              const showKds = routeIncludesKds(row.destination);
              const showPrinter = routeIncludesPrinter(row.destination);
              return (
                <li
                  key={cat.id}
                  className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {POS_ROUTE_DESTINATION_LABELS_DE[row.destination]}
                      </p>
                    </div>
                    <div className="w-full space-y-1.5 sm:max-w-xs">
                      <Label>Ziel</Label>
                      <Select
                        value={row.destination}
                        onValueChange={(v) =>
                          patchRoute(cat.id, {
                            destination: (String(
                              v ?? DEFAULT_POS_ROUTE_DESTINATION,
                            ) || DEFAULT_POS_ROUTE_DESTINATION) as PosRouteDestination,
                          })
                        }
                      >
                        <SelectTrigger
                          className={appSelectTriggerAccentCn("h-9 w-full")}
                        >
                          <SelectValue>
                            {POS_ROUTE_DESTINATION_LABELS_DE[row.destination]}
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
                    </div>
                  </div>

                  {showKds && devices.length > 0 ? (
                    <div className="space-y-2">
                      <Label>KDS-Geräte</Label>
                      <div className="flex flex-wrap gap-2">
                        {devices.map((d) => {
                          const on = row.kdsDeviceIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-medium",
                                on
                                  ? "border-accent/50 bg-accent/10 text-accent"
                                  : "border-border/60 text-muted-foreground",
                              )}
                              onClick={() =>
                                toggleId(cat.id, "kdsDeviceIds", d.id)
                              }
                            >
                              {d.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {showPrinter && printers.length > 0 ? (
                    <div className="space-y-2">
                      <Label>Drucker</Label>
                      <div className="flex flex-wrap gap-2">
                        {printers.map((p) => {
                          const on = row.printerIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-medium",
                                on
                                  ? "border-accent/50 bg-accent/10 text-accent"
                                  : "border-border/60 text-muted-foreground",
                              )}
                              onClick={() =>
                                toggleId(cat.id, "printerIds", p.id)
                              }
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {showPrinter && printers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Noch kein Drucker angelegt — oben unter Bondrucker
                      erfassen.
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    className={brandActionButtonRoundedClassName}
                    disabled={savingId === cat.id}
                    onClick={() => void saveOne(cat.id)}
                  >
                    Speichern
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
