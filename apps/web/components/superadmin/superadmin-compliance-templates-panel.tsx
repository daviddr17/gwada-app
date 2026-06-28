"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PlatformComplianceTemplateEditorDrawer } from "@/components/superadmin/platform-compliance-template-editor-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
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
import { groupPlatformTemplatesByCategory } from "@/lib/compliance/compliance-platform-import";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchSuperadminPlatformComplianceTemplates } from "@/lib/superadmin/platform-compliance-templates-api";
import {
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_FREQUENCY_LABELS,
} from "@/lib/types/compliance";
import type { PlatformComplianceChecklistTemplate } from "@/lib/types/platform-compliance-templates";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function SuperadminComplianceTemplatesPanel() {
  const [countryCode, setCountryCode] = useState("DE");
  const [templates, setTemplates] = useState<PlatformComplianceChecklistTemplate[]>([]);
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
    const result = await fetchSuperadminPlatformComplianceTemplates({ countryCode });
    if (!result.ok) {
      toast.error(
        result.error === "load_failed"
          ? "Vorlagen konnten nicht geladen werden."
          : `Vorlagen konnten nicht geladen werden: ${result.error}`,
      );
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

  const grouped = useMemo(
    () => groupPlatformTemplatesByCategory(templates),
    [templates],
  );

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
              onClick={() => {
                setEditTemplateId(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="size-4" />
              Neue Vorlage
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
              Noch keine Checklisten-Vorlagen für {countryCode} — lege die erste an
              oder wende die Migration mit Seed an.
            </p>
          ) : (
            grouped.map(([category, rows]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {COMPLIANCE_CATEGORY_LABELS[category]}
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
                          {COMPLIANCE_FREQUENCY_LABELS[template.frequency]} ·{" "}
                          {template.items.length} Feld
                          {template.items.length === 1 ? "" : "er"} · Version{" "}
                          {template.version}
                          {template.showOnDisplay ? " · Display" : ""}
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
                        onClick={() => {
                          setEditTemplateId(template.id);
                          setEditorOpen(true);
                        }}
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

      <PlatformComplianceTemplateEditorDrawer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={editTemplateId}
        defaultCountryCode={countryCode}
        onSaved={() => void load()}
      />
    </>
  );
}
