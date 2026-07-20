"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";

type SideItem = {
  menuItemId: string;
  itemName: string;
  priceCents: number;
  sidePriceCents: number | null;
  required: boolean;
  maxSides: number;
  includedCount: number;
  hasConfig: boolean;
};

function fmtEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function PosMenuSideConfigPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [items, setItems] = useState<SideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sidePriceEuro, setSidePriceEuro] = useState("");
  const [required, setRequired] = useState(false);
  const [maxSides, setMaxSides] = useState("1");
  const [included, setIncluded] = useState("0");
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/menu-side-config?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { items?: SideItem[]; error?: string };
      if (!res.ok) toast.error(json.error ?? "Laden fehlgeschlagen");
      else setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, filter]);

  const startEdit = (item: SideItem) => {
    setEditingId(item.menuItemId);
    setSidePriceEuro(
      item.sidePriceCents == null ? "" : fmtEuro(item.sidePriceCents),
    );
    setRequired(item.required);
    setMaxSides(String(item.maxSides));
    setIncluded(String(item.includedCount));
  };

  const save = async () => {
    if (!restaurantId || !editingId) return;
    setSaving(true);
    try {
      const trimmed = sidePriceEuro.trim().replace(",", ".");
      const sidePriceCents =
        trimmed === ""
          ? null
          : Math.round(Number(trimmed) * 100);
      if (sidePriceCents != null && !Number.isFinite(sidePriceCents)) {
        toast.error("Ungültiger Beilagenpreis");
        return;
      }
      const res = await fetch("/api/pos/menu-side-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          menuItemId: editingId,
          sidePriceCents,
          required,
          maxSides: Number(maxSides) || 1,
          includedCount: Number(included) || 0,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Beilagen-Config gespeichert");
      setEditingId(null);
      void load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Beilagen-Preise & Gruppen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          `sidePrice` = Preis als Beilage (Cent). Side-Config: Pflicht / max / inklusive —
          Optionsgruppen weiterhin in der Speisekarte.
        </p>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Artikel suchen …"
        />
        {showSkeleton ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.slice(0, 40).map((item) => (
              <button
                key={item.menuItemId}
                type="button"
                onClick={() => startEdit(item)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  editingId === item.menuItemId
                    ? "border-accent bg-accent/10"
                    : "border-border/50"
                }`}
              >
                <div className="font-medium">{item.itemName}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtEuro(item.priceCents)} € · Beilage{" "}
                  {item.sidePriceCents == null
                    ? "voller Preis"
                    : `${fmtEuro(item.sidePriceCents)} €`}
                  {item.hasConfig
                    ? ` · max ${item.maxSides}${item.required ? " Pflicht" : ""}`
                    : ""}
                </div>
              </button>
            ))}
          </div>
        )}

        {editingId && (
          <div className="space-y-3 rounded-xl border border-border/50 p-3">
            <div className="space-y-1.5">
              <Label>Beilagenpreis (€, leer = voller Preis)</Label>
              <Input
                value={sidePriceEuro}
                onChange={(e) => setSidePriceEuro(e.target.value)}
                inputMode="decimal"
                placeholder="z. B. 0,00"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={required} onCheckedChange={setRequired} />
              Beilage Pflicht
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max. Beilagen</Label>
                <Input
                  value={maxSides}
                  onChange={(e) => setMaxSides(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Inklusive</Label>
                <Input
                  value={included}
                  onChange={(e) => setIncluded(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className={brandActionButtonRoundedClassName}
                disabled={saving}
                onClick={() => void save()}
              >
                Speichern
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingId(null)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
