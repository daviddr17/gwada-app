"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function PosInventorySettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
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
        `/api/pos/settings?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        settings?: { inventoryBookingEnabled?: boolean };
        error?: string;
      };
      if (!res.ok) toast.error(json.error ?? "Einstellungen laden fehlgeschlagen");
      else setEnabled(Boolean(json.settings?.inventoryBookingEnabled));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: boolean) => {
    if (!restaurantId) return;
    setEnabled(next);
    setSaving(true);
    try {
      const res = await fetch("/api/pos/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          inventoryBookingEnabled: next,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Speichern fehlgeschlagen");
        void load();
        return;
      }
      toast.success(next ? "Bestandsbuchung aktiv" : "Bestandsbuchung aus");
    } finally {
      setSaving(false);
    }
  };

  if (!ready || showSkeleton) {
    return <Skeleton className="mt-4 h-28 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Bestand &amp; POS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Optional Rezept-Zutaten aus Speisekarte vom Bestand abziehen, wenn ein
          Ticket einen KDS-Status mit „Bestand buchen“ erreicht. Storno-Gründe
          steuern, ob der Bestand zurückgebucht wird.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor="pos-inventory-booking" className="text-sm font-medium">
              Bestandsbuchung bei Bestellungen
            </Label>
            <p className="text-xs text-muted-foreground">
              Pro KDS-Status festlegen, wann gebucht wird
            </p>
          </div>
          <Switch
            id="pos-inventory-booking"
            checked={enabled}
            disabled={saving}
            onCheckedChange={(v) => void save(v === true)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
