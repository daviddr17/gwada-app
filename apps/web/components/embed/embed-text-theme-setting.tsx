"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EmbedAppearanceWidget } from "@/lib/embed/embed-appearance";
import {
  fetchEmbedTextThemeForRestaurant,
  upsertEmbedTextThemeForRestaurant,
} from "@/lib/supabase/embed-appearance-db";
import { publicSurfaceScopeHint } from "@/lib/ui/public-surface-settings-copy";

export function EmbedTextThemeSetting({
  restaurantId,
  widget,
  disabled = false,
}: {
  restaurantId: string;
  widget: EmbedAppearanceWidget;
  disabled?: boolean;
}) {
  const [lightText, setLightText] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const theme = await fetchEmbedTextThemeForRestaurant(restaurantId, widget);
      if (cancelled) return;
      setLightText(theme === "light");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, widget]);

  const persist = useCallback(
    async (nextLight: boolean) => {
      const result = await upsertEmbedTextThemeForRestaurant(
        restaurantId,
        widget,
        nextLight ? "light" : "dark",
      );
      if (!result.ok) {
        toast.error(result.error);
      }
    },
    [restaurantId, widget],
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
      <div className="space-y-0.5">
        <Label htmlFor={`embed-text-theme-${widget}`} className="text-sm">
          Helle Schrift
        </Label>
        <p className="text-xs text-muted-foreground">
          Für dunkle Website-Hintergründe. Standard ist dunkle Schrift — der
          Widget-Hintergrund ist transparent. {publicSurfaceScopeHint("embed")}
        </p>
      </div>
      <Switch
        id={`embed-text-theme-${widget}`}
        checked={lightText}
        disabled={disabled || loading}
        onCheckedChange={(checked) => {
          const next = checked === true;
          setLightText(next);
          void persist(next);
        }}
      />
    </div>
  );
}
