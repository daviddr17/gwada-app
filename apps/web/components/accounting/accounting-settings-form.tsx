"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { AccountingDocumentLayoutEditor } from "@/components/accounting/accounting-document-layout-editor";
import { AccountingDocumentDesignPreviewSheet } from "@/components/accounting/accounting-document-design-preview-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { AccountingSettingsSkeleton } from "@/components/accounting/accounting-settings-skeleton";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import {
  fetchAccountingSettings,
  saveAccountingSettings,
} from "@/lib/accounting/accounting-api";
import { useAccountingConnector } from "@/lib/hooks/use-accounting-connector";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { ACCOUNTING_DEFAULT_LOCALE } from "@/lib/accounting/accounting-locale";
import {
  ACCOUNTING_DOCUMENT_FORMAT_OPTIONS,
  DEFAULT_ACCOUNTING_DOCUMENT_DESIGN,
  exampleAccountingDocumentNumber,
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
  const { connector } = useAccountingConnector(restaurantId);
  const activeConnectorKey =
    connector.connected && connector.key !== "none" ? connector.key : null;
  const [settings, setSettings] = useState<AccountingSettingsRow | null>(null);
  const [documentFormat, setDocumentFormat] =
    useState<AccountingDocumentFormat>("pdf");
  const [connectorAutoSyncEnabledState, setConnectorAutoSyncEnabledState] =
    useState(true);
  const [deductInventoryOnInvoice, setDeductInventoryOnInvoice] = useState(false);
  const [reverseInventoryOnInvoiceCorrection, setReverseInventoryOnInvoiceCorrection] =
    useState(false);
  const [importPosZToCashBook, setImportPosZToCashBook] = useState(false);
  const [pushPosZToLexoffice, setPushPosZToLexoffice] = useState(false);
  const [documentDesign, setDocumentDesign] = useState<AccountingDocumentDesign>(
    DEFAULT_ACCOUNTING_DOCUMENT_DESIGN,
  );
  const [invoiceNumberPrefix, setInvoiceNumberPrefix] = useState("RE");
  const [invoiceCorrectionNumberPrefix, setInvoiceCorrectionNumberPrefix] =
    useState("KO");
  const [quotationNumberPrefix, setQuotationNumberPrefix] = useState("AN");
  const [invoiceNumberIncludeYear, setInvoiceNumberIncludeYear] = useState(true);
  const [quotationNumberIncludeYear, setQuotationNumberIncludeYear] =
    useState(true);
  const [invoiceNumberMinDigits, setInvoiceNumberMinDigits] = useState(4);
  const [quotationNumberMinDigits, setQuotationNumberMinDigits] = useState(4);
  const [lexofficePushContactUpdates, setLexofficePushContactUpdates] =
    useState(false);
  const [lexofficeImportPdfsToDocuments, setLexofficeImportPdfsToDocuments] =
    useState(false);
  const [lexofficeUseWebhooks, setLexofficeUseWebhooks] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const savedRef = useRef<string | null>(null);

  const showSkeleton = useDeferredSkeleton(loading);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        documentFormat,
        connectorAutoSyncEnabledState,
        deductInventoryOnInvoice,
        reverseInventoryOnInvoiceCorrection,
        importPosZToCashBook,
        pushPosZToLexoffice,
        documentDesign,
        invoiceNumberPrefix,
        invoiceCorrectionNumberPrefix,
        quotationNumberPrefix,
        invoiceNumberIncludeYear,
        quotationNumberIncludeYear,
        invoiceNumberMinDigits,
        quotationNumberMinDigits,
        lexofficePushContactUpdates,
        lexofficeImportPdfsToDocuments,
        lexofficeUseWebhooks,
      }),
    [
      documentFormat,
      connectorAutoSyncEnabledState,
      deductInventoryOnInvoice,
      reverseInventoryOnInvoiceCorrection,
      importPosZToCashBook,
      pushPosZToLexoffice,
      documentDesign,
      invoiceNumberPrefix,
      invoiceCorrectionNumberPrefix,
      quotationNumberPrefix,
      invoiceNumberIncludeYear,
      quotationNumberIncludeYear,
      invoiceNumberMinDigits,
      quotationNumberMinDigits,
      lexofficePushContactUpdates,
      lexofficeImportPdfsToDocuments,
      lexofficeUseWebhooks,
    ],
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
      const nextAutoSync =
        row.connector_settings.lexoffice?.autoSync ?? row.auto_sync_lexoffice;
      const nextDeductInventory = row.deduct_inventory_on_invoice;
      const nextReverseInventory = row.reverse_inventory_on_invoice_correction;
      const nextImportPosZ = row.import_pos_z_to_cash_book ?? false;
      const nextPushPosZ = row.push_pos_z_to_lexoffice ?? false;
      const nextDesign = parseAccountingDocumentDesign(row.document_design);
      const lex = row.connector_settings.lexoffice;
      const nextPushContacts = lex?.pushContactUpdates ?? false;
      const nextImportPdfs = lex?.importPdfsToDocuments ?? false;
      const nextUseWebhooks = lex?.useWebhooks ?? true;
      setSettings(row);
      setDocumentFormat(nextFormat);
      setConnectorAutoSyncEnabledState(nextAutoSync);
      setDeductInventoryOnInvoice(nextDeductInventory);
      setReverseInventoryOnInvoiceCorrection(nextReverseInventory);
      setImportPosZToCashBook(nextImportPosZ);
      setPushPosZToLexoffice(nextPushPosZ);
      setDocumentDesign(nextDesign);
      setInvoiceNumberPrefix(row.invoice_number_prefix);
      setInvoiceCorrectionNumberPrefix(row.invoice_correction_number_prefix);
      setQuotationNumberPrefix(row.quotation_number_prefix);
      setInvoiceNumberIncludeYear(row.invoice_number_include_year);
      setQuotationNumberIncludeYear(row.quotation_number_include_year);
      setInvoiceNumberMinDigits(row.invoice_number_min_digits);
      setQuotationNumberMinDigits(row.quotation_number_min_digits);
      setLexofficePushContactUpdates(nextPushContacts);
      setLexofficeImportPdfsToDocuments(nextImportPdfs);
      setLexofficeUseWebhooks(nextUseWebhooks);
      savedRef.current = JSON.stringify({
        documentFormat: nextFormat,
        connectorAutoSyncEnabledState: nextAutoSync,
        deductInventoryOnInvoice: nextDeductInventory,
        reverseInventoryOnInvoiceCorrection: nextReverseInventory,
        importPosZToCashBook: nextImportPosZ,
        pushPosZToLexoffice: nextPushPosZ,
        documentDesign: nextDesign,
        invoiceNumberPrefix: row.invoice_number_prefix,
        invoiceCorrectionNumberPrefix: row.invoice_correction_number_prefix,
        quotationNumberPrefix: row.quotation_number_prefix,
        invoiceNumberIncludeYear: row.invoice_number_include_year,
        quotationNumberIncludeYear: row.quotation_number_include_year,
        invoiceNumberMinDigits: row.invoice_number_min_digits,
        quotationNumberMinDigits: row.quotation_number_min_digits,
        lexofficePushContactUpdates: nextPushContacts,
        lexofficeImportPdfsToDocuments: nextImportPdfs,
        lexofficeUseWebhooks: nextUseWebhooks,
      });
    } catch {
      toast.error("Einstellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, connector.key, connector.connected]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!restaurantId || !dirty) return;
    setSaving(true);
    try {
      const row = await saveAccountingSettings(restaurantId, {
        documentFormat,
        ...(activeConnectorKey
          ? {
              connectorAutoSync: {
                connector: activeConnectorKey,
                enabled: connectorAutoSyncEnabledState,
              },
            }
          : {}),
        deductInventoryOnInvoice,
        reverseInventoryOnInvoiceCorrection,
        importPosZToCashBook,
        pushPosZToLexoffice:
          activeConnectorKey === "lexoffice" ? pushPosZToLexoffice : false,
        documentDesign,
        invoiceNumberPrefix,
        invoiceCorrectionNumberPrefix,
        quotationNumberPrefix,
        invoiceNumberIncludeYear,
        quotationNumberIncludeYear,
        invoiceNumberMinDigits,
        quotationNumberMinDigits,
        ...(activeConnectorKey === "lexoffice"
          ? {
              lexofficeFeatures: {
                pushContactUpdates: lexofficePushContactUpdates,
                importPdfsToDocuments: lexofficeImportPdfsToDocuments,
                useWebhooks: lexofficeUseWebhooks,
              },
            }
          : {}),
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

  const numberingPreview = useMemo(
    () => ({
      invoiceNumberPrefix,
      invoiceCorrectionNumberPrefix,
      quotationNumberPrefix,
      invoiceNumberIncludeYear,
      quotationNumberIncludeYear,
      invoiceNumberMinDigits,
      quotationNumberMinDigits,
    }),
    [
      invoiceNumberPrefix,
      invoiceCorrectionNumberPrefix,
      quotationNumberPrefix,
      invoiceNumberIncludeYear,
      quotationNumberIncludeYear,
      invoiceNumberMinDigits,
      quotationNumberMinDigits,
    ],
  );

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && showSkeleton) {
    return <AccountingSettingsSkeleton />;
  }

  if (loading && !showSkeleton) {
    return <div aria-busy className="min-h-[32rem]" />;
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

              {activeConnectorKey ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">
                      {connector.displayName} im Hintergrund abgleichen
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rechnungen, Angebote und Belege aus {connector.displayName}{" "}
                      regelmäßig synchronisieren (Cron alle 10 Min., Webhooks
                      wenn aktiviert).
                    </p>
                  </div>
                  <Switch
                    checked={connectorAutoSyncEnabledState}
                    onCheckedChange={setConnectorAutoSyncEnabledState}
                    disabled={loading || saving}
                  />
                </div>
              ) : null}

              {activeConnectorKey === "lexoffice" ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Lexware-Webhooks</p>
                      <p className="text-xs text-muted-foreground">
                        Echtzeit-Events für Kontakte und Belege — Cron bleibt
                        Fallback.
                      </p>
                    </div>
                    <Switch
                      checked={lexofficeUseWebhooks}
                      onCheckedChange={setLexofficeUseWebhooks}
                      disabled={loading || saving}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        Kontakt-Änderungen zu Lexware senden
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Verknüpfte Gwada-Kontakte beim Speichern per PUT in
                        Lexware aktualisieren.
                      </p>
                    </div>
                    <Switch
                      checked={lexofficePushContactUpdates}
                      onCheckedChange={setLexofficePushContactUpdates}
                      disabled={loading || saving}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        Lexware-PDFs in Dokumente importieren
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rechnungen, Angebote und Belege nach Sync/Webhook als
                        PDF ins Dokumenten-Modul — ohne Duplikate.
                      </p>
                    </div>
                    <Switch
                      checked={lexofficeImportPdfsToDocuments}
                      onCheckedChange={setLexofficeImportPdfsToDocuments}
                      disabled={loading || saving}
                    />
                  </div>
                </>
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    POS-Tagesabschluss ins Kassenbuch
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nach dem Z-Abschluss Barverkauf und Trinkgeld automatisch als
                    Einnahmen im Kassenbuch buchen (MwSt. anteilig). Standard aus.
                  </p>
                </div>
                <Switch
                  checked={importPosZToCashBook}
                  onCheckedChange={setImportPosZToCashBook}
                  disabled={loading || saving}
                />
              </div>

              {activeConnectorKey === "lexoffice" ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">
                      POS-Tagesabschluss an Lexoffice
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Zusätzlich Verkaufsbeleg mit Umsatz je MwSt.-Satz und Trinkgeld
                      an Lexoffice senden. Nur mit verbundener Lexoffice-Integration.
                    </p>
                  </div>
                  <Switch
                    checked={pushPosZToLexoffice}
                    onCheckedChange={setPushPosZToLexoffice}
                    disabled={loading || saving}
                  />
                </div>
              ) : null}

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

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    Bestand bei Korrektur zurückbuchen
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bei Korrektur-Rechnung Zutaten laut Artikel-Rezept wieder ins
                    Lager buchen — nur wenn an der Ursprungsrechnung zuvor Bestand
                    abgezogen wurde.
                  </p>
                </div>
                <Switch
                  checked={reverseInventoryOnInvoiceCorrection}
                  onCheckedChange={setReverseInventoryOnInvoiceCorrection}
                  disabled={loading || saving}
                />
              </div>

              {activeConnectorKey && settings?.last_lexoffice_invoices_sync_at ? (
                <p className="text-xs text-muted-foreground">
                  Letzter Rechnungs-Abruf ({connector.displayName}):{" "}
                  {new Date(settings.last_lexoffice_invoices_sync_at).toLocaleString(
                    ACCOUNTING_DEFAULT_LOCALE,
                  )}
                </p>
              ) : null}
              {activeConnectorKey && settings?.last_lexoffice_quotations_sync_at ? (
                <p className="text-xs text-muted-foreground">
                  Letzter Angebots-Abruf ({connector.displayName}):{" "}
                  {new Date(
                    settings.last_lexoffice_quotations_sync_at,
                  ).toLocaleString(ACCOUNTING_DEFAULT_LOCALE)}
                </p>
              ) : null}
              {activeConnectorKey && settings?.last_lexoffice_vouchers_sync_at ? (
                <p className="text-xs text-muted-foreground">
                  Letzter Beleg-Abruf ({connector.displayName}):{" "}
                  {new Date(settings.last_lexoffice_vouchers_sync_at).toLocaleString(
                    ACCOUNTING_DEFAULT_LOCALE,
                  )}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Belegnummern (Gwada)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Fortlaufende Nummern für in Gwada erstellte Rechnungen und
                Angebote — getrennte Zähler, unabhängig von Lexware.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                  <p className="text-sm font-medium">Rechnungen</p>
                  <div className="space-y-2">
                    <Label>Präfix</Label>
                    <Input
                      value={invoiceNumberPrefix}
                      onChange={(e) => setInvoiceNumberPrefix(e.target.value)}
                      disabled={loading || saving}
                      className="h-11 rounded-xl"
                      placeholder="RE"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stellen (Zähler)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={invoiceNumberMinDigits}
                      onChange={(e) =>
                        setInvoiceNumberMinDigits(
                          Math.min(10, Math.max(1, Number(e.target.value) || 4)),
                        )
                      }
                      disabled={loading || saving}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">Jahr einbinden</Label>
                    <Switch
                      checked={invoiceNumberIncludeYear}
                      onCheckedChange={setInvoiceNumberIncludeYear}
                      disabled={loading || saving}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Beispiel:{" "}
                    {exampleAccountingDocumentNumber(numberingPreview, "invoice")}
                  </p>
                  <div className="space-y-2 border-t border-border/40 pt-3">
                    <Label>Korrektur-Präfix</Label>
                    <Input
                      value={invoiceCorrectionNumberPrefix}
                      onChange={(e) =>
                        setInvoiceCorrectionNumberPrefix(e.target.value)
                      }
                      disabled={loading || saving}
                      className="h-11 rounded-xl"
                      placeholder="KO"
                    />
                    <p className="text-xs text-muted-foreground">
                      Beispiel:{" "}
                      {exampleAccountingDocumentNumber(
                        numberingPreview,
                        "invoice_correction",
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                  <p className="text-sm font-medium">Angebote</p>
                  <div className="space-y-2">
                    <Label>Präfix</Label>
                    <Input
                      value={quotationNumberPrefix}
                      onChange={(e) => setQuotationNumberPrefix(e.target.value)}
                      disabled={loading || saving}
                      className="h-11 rounded-xl"
                      placeholder="AN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stellen (Zähler)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={quotationNumberMinDigits}
                      onChange={(e) =>
                        setQuotationNumberMinDigits(
                          Math.min(10, Math.max(1, Number(e.target.value) || 4)),
                        )
                      }
                      disabled={loading || saving}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">Jahr einbinden</Label>
                    <Switch
                      checked={quotationNumberIncludeYear}
                      onCheckedChange={setQuotationNumberIncludeYear}
                      disabled={loading || saving}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Beispiel:{" "}
                    {exampleAccountingDocumentNumber(numberingPreview, "quotation")}
                  </p>
                </div>
              </div>
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
