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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { PosRestaurantPaymentMethodDto } from "@/lib/types/pos-payment-methods";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

const KIND_HINT: Record<string, string> = {
  cash: "Kassenbuch · fest",
  unbar: "Zahlungsdienstleister folgt (Mollie/Adyen) · fest",
  voucher: "Wertgutscheine · fest",
  custom: "Eigene Art · immer Unbar (TSE)",
};

export function PosPaymentMethodsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [methods, setMethods] = useState<PosRestaurantPaymentMethodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
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
        `/api/pos/payment-methods?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        methods?: PosRestaurantPaymentMethodDto[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Zahlungsarten laden fehlgeschlagen");
        return;
      }
      setMethods(json.methods ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCustom = async () => {
    if (!restaurantId || !newLabel.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pos/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, label: newLabel.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Anlegen fehlgeschlagen");
        return;
      }
      setNewLabel("");
      toast.success("Zahlungsart angelegt");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const patchMethod = async (
    id: string,
    patch: { label?: string; isActive?: boolean },
  ) => {
    if (!restaurantId) return;
    const res = await fetch(`/api/pos/payment-methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, ...patch }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Speichern fehlgeschlagen");
      await load();
      return;
    }
    await load();
  };

  const removeCustom = async (id: string) => {
    if (!restaurantId) return;
    if (!window.confirm("Eigene Zahlungsart wirklich löschen?")) return;
    const res = await fetch(`/api/pos/payment-methods/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Löschen fehlgeschlagen");
      return;
    }
    toast.success("Zahlungsart gelöscht");
    await load();
  };

  if (showSkeleton) {
    return <Skeleton className="h-56 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Zahlungsarten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bar, Unbar und Gutschein sind fest. Eigene Arten (z. B. externes
          Terminal oder Fremd-Gutschein) sind beim Bezahlen wählbar und erscheinen
          in Statistik und Z-Bericht.
        </p>

        <ul className="space-y-3">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-2 rounded-xl border border-border/40 px-3 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 space-y-1">
                {m.is_system ? (
                  <p className="font-medium">{m.label}</p>
                ) : (
                  <Input
                    defaultValue={m.label}
                    className="h-9 max-w-xs"
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== m.label) {
                        void patchMethod(m.id, { label: next });
                      }
                    }}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {KIND_HINT[m.kind] ?? m.kind}
                  {!m.collectable && m.kind === "unbar"
                    ? " · noch nicht kassierbar"
                    : null}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {m.kind === "unbar" || m.kind === "custom" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={(checked) =>
                        void patchMethod(m.id, { isActive: Boolean(checked) })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Aktiv</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Immer aktiv</span>
                )}
                {!m.is_system ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void removeCustom(m.id)}
                    aria-label="Löschen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-border/40 pt-4">
          <Label htmlFor="pm-new">Eigene Zahlungsart</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="pm-new"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="z. B. EC extern, Sodexo…"
              className="sm:max-w-xs"
            />
            <Button
              type="button"
              className={cn(brandActionButtonRoundedClassName)}
              disabled={saving || !newLabel.trim()}
              onClick={() => void addCustom()}
            >
              <Plus className="size-4" />
              Anlegen
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
