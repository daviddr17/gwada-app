"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PlatformContractTemplateEditorDrawer } from "@/components/superadmin/platform-contract-template-editor-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { fetchSuperadminPlatformContractTemplates } from "@/lib/superadmin/platform-contract-templates-api";
import {
  PLATFORM_EMPLOYMENT_LEGACY_LABELS,
  type PlatformStaffContractTemplate,
} from "@/lib/types/platform-contract-templates";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function SuperadminContractTemplatesPanel() {
  const [countryCode, setCountryCode] = useState("DE");
  const [templates, setTemplates] = useState<PlatformStaffContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);

  const countryOptions = useMemo(
    () =>
      COUNTRIES_REFERENCE_FALLBACK.filter((c) =>
        ["DE", "AT", "CH", "FR"].includes(c.iso2),
      ),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchSuperadminPlatformContractTemplates({ countryCode });
    if (!result.ok) {
      toast.error("Vorlagen konnten nicht geladen werden.");
      setTemplates([]);
    } else {
      setTemplates(result.templates);
    }
    setLoading(false);
  }, [countryCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const showSkeleton = useDeferredSkeleton(loading && templates.length === 0);

  const openCreate = () => {
    setEditTemplateId(null);
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    setEditTemplateId(id);
    setEditorOpen(true);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformStaffContractTemplate[]>();
    for (const template of templates) {
      const key = template.employmentLegacyKey;
      const list = map.get(key) ?? [];
      list.push(template);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) =>
      (PLATFORM_EMPLOYMENT_LEGACY_LABELS[a[0] as keyof typeof PLATFORM_EMPLOYMENT_LEGACY_LABELS] ?? a[0]).localeCompare(
        PLATFORM_EMPLOYMENT_LEGACY_LABELS[b[0] as keyof typeof PLATFORM_EMPLOYMENT_LEGACY_LABELS] ?? b[0],
      ),
    );
  }, [templates]);

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-col gap-4">
          <div className="min-w-0">
            <CardTitle className="text-xl">Bibliothek</CardTitle>
            <CardDescription>
              Mustertexte pro Land — Restaurants importieren eine Kopie in ihre
              Beschäftigungsverhältnisse.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
                  className={appSelectTriggerAccentCn("h-9 w-full min-w-[10rem] sm:w-[10rem]")}
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
                Neue Vorlage
              </Button>
            </div>
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
              Noch keine Vorlagen für {countryCode} — lege die erste an oder
              wende die Migration mit Seed an.
            </p>
          ) : (
            grouped.map(([legacyKey, rows]) => (
              <div key={legacyKey} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {PLATFORM_EMPLOYMENT_LEGACY_LABELS[
                    legacyKey as keyof typeof PLATFORM_EMPLOYMENT_LEGACY_LABELS
                  ] ?? legacyKey}
                </h3>
                <ul className="space-y-2">
                  {rows.map((template) => (
                    <li
                      key={template.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/70 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{template.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {template.title || "Ohne Überschrift"} · Version{" "}
                          {template.version}
                        </p>
                      </div>
                      {!template.isActive ? (
                        <Badge variant="secondary">Inaktiv</Badge>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg"
                        aria-label="Vorlage bearbeiten"
                        onClick={() => openEdit(template.id)}
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

      <PlatformContractTemplateEditorDrawer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={editTemplateId}
        defaultCountryCode={countryCode}
        onSaved={() => void load()}
      />
    </>
  );
}
