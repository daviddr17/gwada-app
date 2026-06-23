"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  PLATFORM_EMPLOYMENT_LEGACY_LABELS,
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

  const importOne = async (platformTemplateId: string) => {
    setImportingId(platformTemplateId);
    const result = await importPlatformContractTemplates({
      restaurantId,
      employmentTypeId: employmentTypeId ?? undefined,
      platformTemplateIds: [platformTemplateId],
    });
    setImportingId(null);
    if (!result.ok) {
      toast.error("Import fehlgeschlagen.");
      return;
    }
    if (result.imported === 0) {
      toast.message("Vorlage war bereits importiert.");
    } else {
      toast.success("Vorlage importiert.");
    }
    onImported?.();
    void reload();
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
              ? `${employmentTypeName} — Plattform-Vorlagen für ${countryLabel}`
              : `Standardvorlagen für ${countryLabel} (alle Beschäftigungsarten)`}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <div className="mb-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full border-border/60"
              aria-label="Aktualisieren"
              onClick={() => void reload()}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>

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
                Keine Plattform-Vorlagen für {countryLabel}
                {employmentTypeName ? ` / ${employmentTypeName}` : ""}.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => {
                  const busy = importingId === item.id || bulkPending;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/70 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {PLATFORM_EMPLOYMENT_LEGACY_LABELS[item.employmentLegacyKey]} · v
                          {item.version}
                        </p>
                      </div>
                      {item.alreadyImported ? (
                        item.updateAvailable ? (
                          <Badge variant="outline">Update verfügbar</Badge>
                        ) : (
                          <Badge variant="secondary">Importiert</Badge>
                        )
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={drawerFormFullWidthButtonClassName}
                          disabled={busy}
                          onClick={() => void importOne(item.id)}
                        >
                          Importieren
                        </Button>
                      )}
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
