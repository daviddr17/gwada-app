"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { AccountingDocumentLayoutEditor } from "@/components/accounting/accounting-document-layout-editor";
import { AccountingDocumentDesignPreviewSheet } from "@/components/accounting/accounting-document-design-preview-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import {
  fetchAccountingSettings,
  saveAccountingSettings,
} from "@/lib/accounting/accounting-api";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  ACCOUNTING_DOCUMENT_FORMAT_OPTIONS,
  DEFAULT_ACCOUNTING_DOCUMENT_DESIGN,
  parseAccountingDocumentDesign,
  type AccountingDocumentDesign,
  type AccountingDocumentFormat,
  type AccountingSettingsRow,
} from "@/lib/types/accounting-settings";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";

export function AccountingSettingsForm() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [settings, setSettings] = useState<AccountingSettingsRow | null>(null);
  const [documentFormat, setDocumentFormat] =
    useState<AccountingDocumentFormat>("pdf");
  const [autoSyncLexoffice, setAutoSyncLexoffice] = useState(true);
  const [deductInventoryOnInvoice, setDeductInventoryOnInvoice] = useState(false);
  const [documentDesign, setDocumentDesign] = useState<AccountingDocumentDesign>(
    DEFAULT_ACCOUNTING_DOCUMENT_DESIGN,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const savedRef = useRef<string | null>(null);

  const showSkeleton = useDeferredSkeleton(loading);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        documentFormat,
        autoSyncLexoffice,
        deductInventoryOnInvoice,
        documentDesign,
      }),
    [documentFormat, autoSyncLexoffice, deductInventoryOnInvoice, documentDesign],
  );

  const dirty =
    savedRef.current !== null && !loading && snapshot !== savedRef.current;

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    savedRef.current = null;
    try {
      const { settings: row } = await fetchAccountingSettings(restaurantId);
      const nextFormat = row.document_format;
      const nextAutoSync = row.auto_sync_lexoffice;
      const nextDeductInventory = row.deduct_inventory_on_invoice;
      const nextDesign = parseAccountingDocumentDesign(row.document_design);
      setSettings(row);
      setDocumentFormat(nextFormat);
      setAutoSyncLexoffice(nextAutoSync);
      setDeductInventoryOnInvoice(nextDeductInventory);
      setDocumentDesign(nextDesign);
      savedRef.current = JSON.stringify({
        documentFormat: nextFormat,
        autoSyncLexoffice: nextAutoSync,
        deductInventoryOnInvoice: nextDeductInventory,
        documentDesign: nextDesign,
      });
    } catch {
      toast.error("Einstellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!restaurantId || !dirty) return;
    setSaving(true);
    try {
      const row = await saveAccountingSettings(restaurantId, {
        documentFormat,
        autoSyncLexoffice,
        deductInventoryOnInvoice,
        documentDesign,
      });
      setSettings(row);
      savedRef.current = snapshot;
      toast.success("Einstellungen gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && showSkeleton) {
    return (
      <div className="space-y-4">
        <SkeletonCardFrame className="min-h-40" />
        <SkeletonCardFrame className="min-h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-4">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className="space-y-4">
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Allgemein</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Dokumentformat</Label>
                <SearchableSelect
                  value={documentFormat}
                  onValueChange={(v) =>
                    setDocumentFormat(v as AccountingDocumentFormat)
                  }
                  options={ACCOUNTING_DOCUMENT_FORMAT_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  className={appSelectTriggerAccentCn("h-11 w-full")}
                  searchPlaceholder="Format"
                  aria-label="Dokumentformat"
                  disabled={loading || saving}
                />
                <p className="text-xs text-muted-foreground">
                  {
                    ACCOUNTING_DOCUMENT_FORMAT_OPTIONS.find(
                      (o) => o.value === documentFormat,
                    )?.description
                  }
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Lexware beim Laden abgleichen</p>
                  <p className="text-xs text-muted-foreground">
                    Bestehende Rechnungen/Angebote aus Lexware importieren bzw.
                    aktualisieren.
                  </p>
                </div>
                <Switch
                  checked={autoSyncLexoffice}
                  onCheckedChange={setAutoSyncLexoffice}
                  disabled={loading || saving}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Bestand bei Rechnung abziehen</p>
                  <p className="text-xs text-muted-foreground">
                    Bei Rechnungserstellung Zutaten laut Artikel-Rezept aus dem Bestand
                    buchen (nur wenn am Artikel ein Rezept hinterlegt ist).
                  </p>
                </div>
                <Switch
                  checked={deductInventoryOnInvoice}
                  onCheckedChange={setDeductInventoryOnInvoice}
                  disabled={loading || saving}
                />
              </div>

              {settings?.last_lexoffice_invoices_sync_at ? (
                <p className="text-xs text-muted-foreground">
                  Letzter Rechnungs-Abruf:{" "}
                  {new Date(settings.last_lexoffice_invoices_sync_at).toLocaleString(
                    "de-DE",
                  )}
                </p>
              ) : null}
              {settings?.last_lexoffice_quotations_sync_at ? (
                <p className="text-xs text-muted-foreground">
                  Letzter Angebots-Abruf:{" "}
                  {new Date(
                    settings.last_lexoffice_quotations_sync_at,
                  ).toLocaleString("de-DE")}
                </p>
              ) : null}
              {settings?.last_lexoffice_vouchers_sync_at ? (
                <p className="text-xs text-muted-foreground">
                  Letzter Beleg-Abruf:{" "}
                  {new Date(settings.last_lexoffice_vouchers_sync_at).toLocaleString(
                    "de-DE",
                  )}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <CardTitle className="text-base">Layout Rechnungen & Angebote</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-full"
                disabled={saving}
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="size-4" />
                Vorschau
              </Button>
            </CardHeader>
            <CardContent>
              <AccountingDocumentLayoutEditor
                design={documentDesign}
                onChange={(patch) =>
                  setDocumentDesign((prev) => ({ ...prev, ...patch }))
                }
                disabled={loading || saving}
              />
            </CardContent>
          </Card>
        </div>

        <SettingsStickySaveBar show={dirty}>
          <Button
            type="submit"
            disabled={saving || loading || !dirty}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            {saving ? "Speichern …" : "Speichern"}
          </Button>
        </SettingsStickySaveBar>
      </form>

      <AccountingDocumentDesignPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        restaurantId={restaurantId}
        documentDesign={documentDesign}
      />
    </div>
  );
}
