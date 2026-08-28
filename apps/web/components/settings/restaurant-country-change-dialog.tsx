"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import type { CountryChangePreviewRow } from "@/lib/restaurant/country-change-preview";

export function RestaurantCountryChangeDialog({
  open,
  onOpenChange,
  rows,
  nextCountryLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CountryChangePreviewRow[];
  nextCountryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Land wechseln nach {nextCountryLabel}?</DialogTitle>
          <DialogDescription>
            Viele Einstellungen orientieren sich am Restaurant-Land. Bestehende
            Verträge, Zeiteinträge und Buchungen bleiben unverändert — es
            ändern sich Vorschläge und künftige Defaults.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm">
          {rows.map((row) => (
            <li
              key={row.key}
              className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
            >
              <p className="font-medium">{row.label}</p>
              <p className="mt-1 text-muted-foreground">
                <span className="line-through">{row.before}</span>
                {" → "}
                <span className="text-foreground">{row.after}</span>
              </p>
              {row.informational ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nur Hinweis — bestehende Daten bleiben erhalten.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Die App-UI-Sprache jedes Users bleibt im Profil unter „Sprache“
          unabhängig vom Restaurant-Land einstellbar.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={onConfirm}
          >
            Land wirklich wechseln
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
