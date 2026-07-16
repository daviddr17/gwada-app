"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  POS_ORDER_COURSE_LABELS_DE,
  POS_ORDER_COURSES,
  type PosOrderCourse,
} from "@gwada/pos-domain";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type KdsDevice = {
  id: string;
  name: string;
  menuCategoryIds: string[];
  courses: PosOrderCourse[];
  isActive: boolean;
};

type MenuCategory = { id: string; name: string };

export function PosKdsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [devices, setDevices] = useState<KdsDevice[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [courses, setCourses] = useState<PosOrderCourse[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [devRes, bootRes] = await Promise.all([
        fetch(
          `/api/pos/kds/devices?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/pos/bootstrap?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
      ]);
      const devJson = (await devRes.json()) as {
        devices?: KdsDevice[];
        error?: string;
      };
      const bootJson = (await bootRes.json()) as {
        menu?: { categories?: MenuCategory[] };
        error?: string;
      };
      if (!devRes.ok) toast.error(devJson.error ?? "KDS laden fehlgeschlagen");
      else setDevices(devJson.devices ?? []);
      if (bootRes.ok) setCategories(bootJson.menu?.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!restaurantId || !name.trim()) return;
    const res = await fetch("/api/pos/kds/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        name: name.trim(),
        courses,
        menuCategoryIds: categoryIds,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Speichern fehlgeschlagen");
      return;
    }
    toast.success("KDS angelegt");
    setName("");
    setCourses([]);
    setCategoryIds([]);
    void load();
  };

  const remove = async (id: string) => {
    if (!restaurantId) return;
    const res = await fetch("/api/pos/kds/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, id, delete: true }),
    });
    if (!res.ok) {
      toast.error("Löschen fehlgeschlagen");
      return;
    }
    void load();
  };

  if (!ready || showSkeleton) {
    return <Skeleton className="mt-4 h-40 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">KDS-Geräte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Küchen-Displays filtern Bestellungen nach Kategorie und Gang. Lokal
          im WLAN:{" "}
          <span className="font-medium text-foreground">
            http://&lt;Kassen-IP&gt;:8787/v1/kds
          </span>
        </p>

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="kds-name">Name</Label>
            <Input
              id="kds-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Hot Kitchen"
            />
          </div>
          <div className="space-y-2">
            <Label>Gänge</Label>
            <div className="flex flex-wrap gap-2">
              {POS_ORDER_COURSES.map((c) => {
                const on = courses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      on
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border/60 text-muted-foreground",
                    )}
                    onClick={() =>
                      setCourses((prev) =>
                        on ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                  >
                    {POS_ORDER_COURSE_LABELS_DE[c]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Leer = alle Gänge
            </p>
          </div>
          {categories.length > 0 ? (
            <div className="space-y-2">
              <Label>Kategorien</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const on = categoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        on
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border/60 text-muted-foreground",
                      )}
                      onClick={() =>
                        setCategoryIds((prev) =>
                          on
                            ? prev.filter((x) => x !== cat.id)
                            : [...prev, cat.id],
                        )
                      }
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Leer = alle Kategorien
              </p>
            </div>
          ) : null}
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={() => void save()}
            disabled={!name.trim()}
          >
            <Plus className="size-4" />
            KDS anlegen
          </Button>
        </div>

        <ul className="divide-y divide-border/40">
          {devices.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">
              Noch keine KDS-Geräte.
            </li>
          ) : (
            devices.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.courses.length
                      ? d.courses
                          .map((c) => POS_ORDER_COURSE_LABELS_DE[c] ?? c)
                          .join(", ")
                      : "Alle Gänge"}
                    {" · "}
                    {d.menuCategoryIds.length
                      ? `${d.menuCategoryIds.length} Kategorien`
                      : "Alle Kategorien"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void remove(d.id)}
                  aria-label="Löschen"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
