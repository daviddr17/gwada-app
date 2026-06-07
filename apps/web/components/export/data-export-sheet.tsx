"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

type DataExportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemCount: number;
  emptyLabel?: string;
  csvHint?: string;
  pdfHint?: string;
  onCsv: () => void;
  onPdf: () => void;
};

export function DataExportSheet({
  open,
  onOpenChange,
  title,
  description,
  itemCount,
  emptyLabel = "Noch keine Einträge zum Exportieren.",
  csvHint = "Für Excel, Numbers oder weitere Auswertung",
  pdfHint = "Tabellarische Übersicht mit Seitenzahlen zum Ausdrucken",
  onCsv,
  onPdf,
}: DataExportSheetProps) {
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
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {itemCount > 0 ? description : emptyLabel}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 rounded-xl px-4"
            disabled={itemCount === 0}
            onClick={onCsv}
          >
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Als CSV</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {csvHint}
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 rounded-xl px-4"
            disabled={itemCount === 0}
            onClick={onPdf}
          >
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Als PDF</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {pdfHint}
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
