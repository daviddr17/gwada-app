"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  fetchReservationSettings,
  upsertReservationSettings,
} from "@/lib/supabase/reservation-settings-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import Link from "next/link";

export function ReservationSettingsForm() {
  const { restaurantId, supabaseEnvOk } = useWorkspaceRestaurantUuid();
  const [minutes, setMinutes] = useState("120");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchReservationSettings(restaurantId);
      if (cancel) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setMinutes(String(data?.default_dwell_minutes ?? 120));
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId]);

  const save = () => {
    if (!restaurantId) return;
    const n = Number.parseInt(minutes, 10);
    if (!Number.isFinite(n) || n < 15 || n > 1440) {
      toast.error("Bitte 15–1440 Minuten eingeben.");
      return;
    }
    setSaving(true);
    void (async () => {
      const { error } = await upsertReservationSettings({
        restaurantId,
        defaultDwellMinutes: n,
      });
      setSaving(false);
      if (error) toast.error(error.message);
      else toast.success("Standard-Verweildauer gespeichert.");
    })();
  };

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!restaurantId) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein Workspace-Restaurant —{" "}
        <Link
          href="/workspace/restaurants"
          className="font-medium text-foreground underline underline-offset-2"
        >
          hier auswählen
        </Link>
        .
      </p>
    );
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Reservierungs-Einstellungen</CardTitle>
        <CardDescription>
          Standard-Verweildauer für neue oder geänderte Reservierungen, wenn keine
          eigene Dauer gesetzt ist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="dwell-default" className="text-xs text-muted-foreground">
            Standard-Verweildauer (Minuten)
          </Label>
          <Input
            id="dwell-default"
            type="number"
            min={15}
            max={1440}
            disabled={loading}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45"
          />
        </div>
        <Button
          type="button"
          className="h-11 rounded-xl"
          disabled={saving || loading}
          onClick={save}
        >
          Speichern
        </Button>
      </CardContent>
    </Card>
  );
}
