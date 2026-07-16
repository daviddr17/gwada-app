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
import { Input } from "@/components/ui/input";
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
import type { PosGiftVoucherPrintFormat } from "@/lib/types/pos-gift-vouchers";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type Settings = {
  restaurant_id: string;
  default_validity_months: number;
  voucher_printer_id: string | null;
  print_format: PosGiftVoucherPrintFormat;
};

type Printer = { id: string; name: string; isActive: boolean };

export function PosGiftVoucherSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [months, setMonths] = useState("36");
  const [printFormat, setPrintFormat] =
    useState<PosGiftVoucherPrintFormat>("both");
  const [printerId, setPrinterId] = useState<string>("none");
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
      const [sRes, pRes] = await Promise.all([
        fetch(
          `/api/pos/gift-vouchers/settings?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/pos/printers?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
      ]);
      const sJson = (await sRes.json()) as {
        settings?: Settings;
        error?: string;
      };
      const pJson = (await pRes.json()) as { printers?: Printer[] };
      if (!sRes.ok) {
        toast.error(sJson.error ?? "Einstellungen laden fehlgeschlagen");
        return;
      }
      if (sJson.settings) {
        setSettings(sJson.settings);
        setMonths(String(sJson.settings.default_validity_months));
        setPrintFormat(sJson.settings.print_format);
        setPrinterId(sJson.settings.voucher_printer_id ?? "none");
      }
      setPrinters(pJson.printers ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!restaurantId) return;
    const m = Number(months);
    if (!Number.isFinite(m) || m < 1 || m > 120) {
      toast.error("Gültigkeit: 1–120 Monate");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pos/gift-vouchers/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          defaultValidityMonths: Math.round(m),
          printFormat,
          voucherPrinterId: printerId === "none" ? null : printerId,
        }),
      });
      const json = (await res.json()) as {
        settings?: Settings;
        error?: string;
      };
      if (!res.ok || !json.settings) {
        toast.error(json.error ?? "Speichern fehlgeschlagen");
        return;
      }
      setSettings(json.settings);
      toast.success("Gutschein-Einstellungen gespeichert");
    } finally {
      setSaving(false);
    }
  };

  if (showSkeleton) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gutscheine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="gv-validity">Standard-Gültigkeit (Monate)</Label>
          <Input
            id="gv-validity"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="max-w-[12rem]"
          />
          <p className="text-xs text-muted-foreground">
            Gilt für neu ausgestellte Gutscheine (Standard 36 = 3 Jahre). Bereits
            ausgestellte behalten ihre damalige Frist.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Druckformat</Label>
          <Select
            value={printFormat}
            onValueChange={(v) => {
              if (v === "a4" || v === "thermal" || v === "both") {
                setPrintFormat(v);
              }
            }}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn("h-9 w-full max-w-sm")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">DIN A4 + Thermo-Bon</SelectItem>
              <SelectItem value="a4">Nur DIN A4</SelectItem>
              <SelectItem value="thermal">Nur Thermo-Bon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Gutschein-Drucker (Thermo)</Label>
          <Select
            value={printerId}
            onValueChange={(v) => {
              if (typeof v === "string") setPrinterId(v);
            }}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn("h-9 w-full max-w-sm")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein spezieller Drucker</SelectItem>
              {printers
                .filter((p) => p.isActive)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Quittungen nutzen weiterhin die normalen Bondrucker. DIN A4 öffnet
            sich als PDF zum Drucken.
          </p>
        </div>

        <Button
          type="button"
          className={cn(brandActionButtonRoundedClassName)}
          disabled={saving || !settings}
          onClick={() => void save()}
        >
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
