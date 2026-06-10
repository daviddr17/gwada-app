import { cn } from "@/lib/utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

/** Einheitliche Höhe für Buchführungs-Formulare (Inputs, Selects, DatePicker). */
export const accountingFormControlClassName = cn(
  "h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 text-sm",
);

export const accountingFormSelectClassName = appSelectTriggerAccentCn(
  cn(accountingFormControlClassName, "px-1.5"),
);

export const accountingFormSectionClassName =
  "space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4";

export const accountingFormSectionTitleClassName =
  "text-sm font-semibold text-foreground";

export const accountingFormGridClassName =
  "grid gap-3 sm:grid-cols-2";

export const accountingLineItemGridClassName =
  "grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]";

export const accountingLineItemHeaderClassName =
  "hidden text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] sm:gap-2 sm:ps-10";
