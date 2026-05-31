"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  downloadMenuCsv,
  downloadMenuPdf,
  menuExportTotals,
  type MenuExportContext,
} from "@/lib/menu/export-menu";

export function MenuExportSheet({
  open,
  onOpenChange,
  exportContext,
  restaurantName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportContext: MenuExportContext;
  restaurantName?: string;
}) {
  const { dishCount, categoryCount } = menuExportTotals(exportContext);

  const handleCsv = () => {
    if (dishCount === 0) return;
    try {
      downloadMenuCsv(exportContext, { restaurantName });
      toast.success("CSV wurde heruntergeladen.");
      onOpenChange(false);
    } catch {
      toast.error("CSV-Export fehlgeschlagen.");
    }
  };

  const handlePdf = () => {
    if (dishCount === 0) return;
    void (async () => {
      try {
        await downloadMenuPdf(exportContext, { restaurantName });
        toast.success("PDF wurde heruntergeladen.");
        onOpenChange(false);
      } catch {
        toast.error("PDF-Export fehlgeschlagen.");
      }
    })();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto flex max-h-[min(88dvh,420px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Speisekarte exportieren
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {dishCount > 0
              ? `${dishCount} Gericht${dishCount === 1 ? "" : "e"} · ${categoryCount} Kategorie${categoryCount === 1 ? "" : "n"}`
              : "Noch keine Gerichte vorhanden."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 rounded-xl px-4"
            disabled={dishCount === 0}
            onClick={handleCsv}
          >
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Als CSV</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Für Excel, Numbers oder weitere Auswertung
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 rounded-xl px-4"
            disabled={dishCount === 0}
            onClick={handlePdf}
          >
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Als PDF</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Tabellarische Übersicht mit Seitenzahlen zum Ausdrucken
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
