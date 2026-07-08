import type { PrintJsPdfResult } from "@/lib/export/print-host";
import { toast } from "sonner";

export function notifyPrintResult(result: PrintJsPdfResult): void {
  if (result === "opened_tab") {
    toast.message(
      "PDF in neuem Tab geöffnet — dort mit Drucken (⌘P) fortfahren.",
    );
  }
}
