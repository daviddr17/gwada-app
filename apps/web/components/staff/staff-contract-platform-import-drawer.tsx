"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  fetchPlatformContractCatalog,
  importPlatformContractTemplates,
} from "@/lib/staff/staff-contract-platform-import-api";
import {
  type PlatformStaffContractCatalogItem,
} from "@/lib/types/platform-contract-templates";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";

const importActionButtonClassName = cn(
  "h-9",
  drawerFormFullWidthButtonClassName,
);

const importedStatusClassName = cn(
  importActionButtonClassName,
  "inline-flex items-center justify-center gap-1 border border-emerald-500/30 bg-emerald-500/15 px-2.5 text-[0.8rem] font-medium text-emerald-700 dark:text-emerald-400",
);

export function StaffContractPlatformImportDrawer({
  open,
  onOpenChange,
  restaurantId,
  employmentTypeId,
  employmentTypeName,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  employmentTypeId?: string | null;
  employmentTypeName?: string | null;
  onImported?: () => void;
}) {
  const [countryCode, setCountryCode] = useState("DE");
  const [items, setItems] = useState<PlatformStaffContractCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const result = await fetchPlatformContractCatalog({
      restaurantId,
      employmentTypeId: employmentTypeId ?? undefined,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error("Bibliothek konnte nicht geladen werden.");
      setItems([]);
      return;
    }
    setCountryCode(result.countryCode);
    setItems(result.items);
  }, [restaurantId, employmentTypeId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  const importableCount = useMemo(
    () => items.filter((item) => !item.alreadyImported).length,
    [items],
  );

  const sheetLegalNotice = useMemo(() => {
    for (const item of items) {
      const notice = item.legalNotice?.trim();
      if (notice) return notice;
    }
    return null;
  }, [items]);

  const importOne = async (platformTemplateId: string) => {
    setImportingId(platformTemplateId);
    try {
      const result = await importPlatformContractTemplates({
        restaurantId,
        employmentTypeId: employmentTypeId ?? undefined,
        platformTemplateIds: [platformTemplateId],
      });
      if (!result.ok) {
        toast.error("Import fehlgeschlagen.");
        return;
      }
      if (result.imported === 0) {
        toast.message(
          employmentTypeName
            ? "Vorlage ist für dieses Beschäftigungsverhältnis bereits importiert."
            : "Vorlage war bereits importiert.",
        );
      } else {
        toast.success("Vorlage importiert.");
      }
      onImported?.();
      await reload();
    } finally {
      setImportingId(null);
    }
  };

  const importAll = async () => {
    setBulkPending(true);
    const result = await importPlatformContractTemplates({
      restaurantId,
      employmentTypeId: employmentTypeId ?? undefined,
      importAllForCountry: true,
    });
    setBulkPending(false);
    if (!result.ok) {
      toast.error("Import fehlgeschlagen.");
      return;
    }
    toast.success(
      `${result.imported} importiert${result.skipped > 0 ? `, ${result.skipped} übersprungen` : ""}.`,
    );
    onImported?.();
    void reload();
  };

  const countryLabel =
    countryCode === "DE"
      ? "Deutschland"
      : countryCode === "AT"
        ? "Österreich"
        : countryCode === "CH"
          ? "Schweiz"
          : countryCode;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("overview")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Aus Bibliothek importieren
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {employmentTypeName
              ? `Alle Vorlagen für ${countryLabel} — werden „${employmentTypeName}" zugeordnet. Du kannst jede Vorlage einzeln wählen.`
              : `Standardvorlagen für ${countryLabel}: jede Vorlage wird dem passenden Beschäftigungsverhältnis zugeordnet (Vollzeit, Teilzeit, …).`}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          {sheetLegalNotice ? (
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              {sheetLegalNotice}
            </p>
          ) : null}

          {importableCount > 0 ? (
            <Button
              type="button"
              size="lg"
              className={cn("mb-4", modulePrimaryAddButtonFullWidthClassName)}
              disabled={bulkPending || loading}
              onClick={() => void importAll()}
            >
              <Download className="size-4" />
              {bulkPending
                ? "Importiere …"
                : `Alle fehlenden importieren (${importableCount})`}
            </Button>
          ) : null}

          <DrawerFormSection bleed={false}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Wird geladen …</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Plattform-Vorlagen für {countryLabel}.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => {
                  const busy = importingId === item.id || bulkPending;
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-border/40 bg-background/70 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug">
                            {item.name}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          {item.alreadyImported && !item.updateAvailable ? (
                            <span className={importedStatusClassName}>
                              <Check className="size-4 shrink-0" aria-hidden />
                              Importiert
                            </span>
                          ) : item.alreadyImported && item.updateAvailable ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={importActionButtonClassName}
                              disabled={busy}
                              onClick={() => void importOne(item.id)}
                            >
                              {busy && importingId === item.id ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Download className="size-4" aria-hidden />
                              )}
                              Update importieren
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className={importActionButtonClassName}
                              disabled={busy}
                              onClick={() => void importOne(item.id)}
                            >
                              {busy && importingId === item.id ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Download className="size-4" aria-hidden />
                              )}
                              Importieren
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
