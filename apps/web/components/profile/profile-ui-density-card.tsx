"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  applyUiDensity,
  fetchProfileUiDensity,
  hydrateUiDensityFromLocalStore,
} from "@/lib/ui/apply-ui-density";
import {
  DEFAULT_UI_DENSITY,
  normalizeUiDensity,
  type UiDensity,
  UI_DENSITIES,
} from "@/lib/ui/ui-density";
import { cn } from "@/lib/utils";

export function ProfileUiDensityCard({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("Profile.density");
  const [value, setValue] = useState<UiDensity>(DEFAULT_UI_DENSITY);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = hydrateUiDensityFromLocalStore();
      if (local) setValue(local);

      const fromProfile = await fetchProfileUiDensity();
      if (cancelled) return;
      if (fromProfile) setValue(fromProfile);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectDensity(next: UiDensity) {
    if (disabled || saving || !hydrated || next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const result = await applyUiDensity(next);
      if (!result.ok) {
        setValue(previous);
        await applyUiDensity(previous);
        toast.error(t("updateFailed"));
        return;
      }
      toast.success(t("updated"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("heading")}</p>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="space-y-2">
          <Label id="profile-ui-density-label">{t("label")}</Label>
          <div
            role="radiogroup"
            aria-labelledby="profile-ui-density-label"
            className="grid grid-cols-3 gap-2"
          >
            {UI_DENSITIES.map((density) => {
              const selected = value === density;
              return (
                <button
                  key={density}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled || saving || !hydrated}
                  onClick={() => void selectDensity(normalizeUiDensity(density))}
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-center transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-accent bg-accent/15 font-semibold text-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40",
                    (disabled || saving || !hydrated) && "opacity-60",
                  )}
                >
                  <span className="block text-sm leading-tight">
                    {t(density)}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[11px] leading-tight",
                      selected ? "text-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {t(`${density}Hint`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
