"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PlatformFoodMarkingEditorDrawer } from "@/components/superadmin/platform-food-marking-editor-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchSuperadminPlatformFoodMarkings } from "@/lib/superadmin/platform-food-markings-api";
import {
  PLATFORM_FOOD_MARKING_KIND_LABELS,
  type PlatformFoodMarking,
} from "@/lib/types/platform-food-markings";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function SuperadminFoodMarkingsPanel() {
  const [countryCode, setCountryCode] = useState("DE");
  const [markings, setMarkings] = useState<PlatformFoodMarking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editMarkingId, setEditMarkingId] = useState<string | null>(null);

  const countryOptions = useMemo(
    () =>
      COUNTRIES_REFERENCE_FALLBACK.filter((c) =>
        ["DE", "AT", "CH", "FR"].includes(c.iso2),
      ),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchSuperadminPlatformFoodMarkings({ countryCode });
    if (!result.ok) {
      toast.error("Kennzeichnungen konnten nicht geladen werden.");
      setMarkings([]);
    } else {
      setMarkings(result.markings);
    }
    setLoading(false);
  }, [countryCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const showSkeleton = useDeferredSkeleton(loading && markings.length === 0);

  const openCreate = () => {
    setEditMarkingId(null);
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    setEditMarkingId(id);
    setEditorOpen(true);
  };

  const grouped = useMemo(() => {
    const additives = markings.filter((m) => m.kind === "additive");
    const allergens = markings.filter((m) => m.kind === "allergen");
    return [
      { key: "additive" as const, rows: additives },
      { key: "allergen" as const, rows: allergens },
    ].filter((g) => g.rows.length > 0);
  }, [markings]);

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Land</Label>
            <Select
              value={countryCode}
              items={Object.fromEntries(
                countryOptions.map((c) => [c.iso2, c.name_de]),
              )}
              onValueChange={(v) => {
                if (typeof v === "string") setCountryCode(v);
              }}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn(
                  "h-9 w-full min-w-[10rem] sm:w-[10rem]",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map((c) => (
                  <SelectItem key={c.iso2} value={c.iso2}>
                    {c.name_de}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full border-border/60"
              aria-label="Aktualisieren"
              onClick={() => void load()}
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              type="button"
              className={cn(modulePrimaryAddButtonClassName, "flex-1 sm:flex-none")}
              onClick={openCreate}
            >
              <Plus className="size-4" />
              Neuer Eintrag
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showSkeleton ? (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl border border-border/40 bg-muted/20"
                />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Kennzeichnungen für {countryCode} — lege die erste an
              oder wende die Seed-Migration an.
            </p>
          ) : (
            grouped.map(({ key, rows }) => (
              <div key={key} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {PLATFORM_FOOD_MARKING_KIND_LABELS[key]}
                </h3>
                <ul className="space-y-2">
                  {rows.map((marking) => (
                    <li
                      key={marking.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/70 px-3 py-2.5"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-xs font-semibold tabular-nums">
                        {marking.shortLabel}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {marking.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Code {marking.code} · Pos. {marking.sortOrder}
                        </p>
                      </div>
                      {!marking.isActive ? (
                        <Badge variant="secondary">Inaktiv</Badge>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg"
                        aria-label="Eintrag bearbeiten"
                        onClick={() => openEdit(marking.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <PlatformFoodMarkingEditorDrawer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        markingId={editMarkingId}
        defaultCountryCode={countryCode}
        onSaved={() => void load()}
      />
    </>
  );
}
