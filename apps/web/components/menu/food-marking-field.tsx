"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TagMultiCombobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  foodMarkingLabel,
  foodMarkingsAsTaxonomy,
  sortFoodMarkingCodes,
} from "@/lib/menu/food-marking-catalog";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

type FoodMarkingFieldProps = {
  countryIso2: string | null | undefined;
  value: string[];
  onChange: (codes: string[]) => void;
  /** Kontext für KI-Vorschlag */
  suggestName: string;
  suggestDescription?: string;
  kind: "ingredient" | "dish";
  /** Nur Anzeige, z. B. Aggregation aus Zutaten */
  readOnlyCodes?: string[];
  readOnlyHint?: string;
  className?: string;
  disabled?: boolean;
};

export function FoodMarkingField({
  countryIso2,
  value,
  onChange,
  suggestName,
  suggestDescription,
  kind,
  readOnlyCodes,
  readOnlyHint,
  className,
  disabled,
}: FoodMarkingFieldProps) {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const [suggesting, setSuggesting] = useState(false);

  const definitions = useMemo(
    () => foodMarkingsAsTaxonomy(countryIso2),
    [countryIso2],
  );

  const fromIngredients = useMemo(
    () => sortFoodMarkingCodes(readOnlyCodes ?? [], countryIso2),
    [readOnlyCodes, countryIso2],
  );

  const handleSuggest = async () => {
    const name = suggestName.trim();
    if (!name) {
      toast.error(
        kind === "ingredient"
          ? "Bitte zuerst einen Zutaten-Namen eingeben."
          : "Bitte zuerst einen Gerichts-Namen eingeben.",
      );
      return;
    }
    if (!restaurantId) {
      toast.error("Restaurant ist noch nicht bereit.");
      return;
    }
    setSuggesting(true);
    try {
      const res = await fetch("/api/menu/suggest-markings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          kind,
          name,
          description: suggestDescription?.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        codes?: string[];
        aiConfigured?: boolean;
      };
      if (!res.ok) {
        if (data.error === "ai_not_configured" || data.aiConfigured === false) {
          toast.error(
            "Keine Restaurant-KI hinterlegt. Unter Einstellungen → Integrationen einen eigenen OpenAI-/Grok-Schlüssel eintragen.",
          );
          return;
        }
        toast.error("KI-Vorschlag fehlgeschlagen.");
        return;
      }
      const suggested = Array.isArray(data.codes) ? data.codes : [];
      if (suggested.length === 0) {
        toast.message("Keine Kennzeichnungen vorgeschlagen.");
        return;
      }
      const merged = sortFoodMarkingCodes(
        [...value, ...suggested],
        countryIso2,
      );
      onChange(merged);
      toast.success(
        `${suggested.length} Kennzeichnung${suggested.length === 1 ? "" : "en"} vorgeschlagen — bitte prüfen und speichern.`,
      );
    } catch {
      toast.error("KI-Vorschlag fehlgeschlagen.");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {fromIngredients.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {readOnlyHint ?? "Aus verknüpften Zutaten"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fromIngredients.map((code) => (
              <span
                key={`from-ing-${code}`}
                className="inline-flex max-w-full items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-50 dark:ring-amber-800/60"
              >
                <span className="truncate">
                  {foodMarkingLabel(countryIso2, code)}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {kind === "ingredient"
              ? "Auswahl aus der Länderliste"
              : "Zusätzlich am Gericht"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-full border-border/60"
            disabled={disabled || suggesting}
            onClick={() => void handleSuggest()}
          >
            {suggesting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            KI vorschlagen
          </Button>
        </div>
        <TagMultiCombobox
          id={`food-markings-${kind}`}
          definitions={definitions}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-label="Zusatzstoffe und Allergene"
        />
      </div>
    </div>
  );
}
