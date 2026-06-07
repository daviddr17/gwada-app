"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { cn } from "@/lib/utils";

type LocationOption = {
  id: string;
  name: string;
  secondaryLabel: string | null;
};

export function GoogleLocationSelectDialog({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google-business/pending-locations");
      const data = (await res.json()) as {
        locations?: LocationOption[];
        preselectedLocationId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error === "pending_not_found"
            ? "Die Standortauswahl ist abgelaufen. Bitte erneut verbinden."
            : "Google-Standorte konnten nicht geladen werden.",
        );
        onOpenChange(false);
        return;
      }
      setLocations(data.locations ?? []);
      setSelectedId(data.preselectedLocationId ?? null);
    } catch {
      toast.error("Netzwerkfehler (Google Business).");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    void loadLocations();
  }, [open, loadLocations]);

  const confirm = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/google-business/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: selectedId }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(data.error ?? "Verbinden fehlgeschlagen.");
        return;
      }
      toast.success("Google Business verbunden.");
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error("Netzwerkfehler (Google Business).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/50 shadow-card">
        <DialogHeader>
          <DialogTitle>Standort auswählen</DialogTitle>
          <DialogDescription>
            Mehrere Google-Business-Profile gefunden. Welches soll mit diesem
            Restaurant verbunden werden?
          </DialogDescription>
        </DialogHeader>
        <div
          className="max-h-[min(50vh,320px)] space-y-2 overflow-y-auto py-1"
          role="listbox"
          aria-label="Google-Business-Standorte"
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Standorte werden geladen…</p>
          ) : locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Standorte verfügbar.
            </p>
          ) : (
            locations.map((loc) => {
              const selected = selectedId === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedId(loc.id)}
                  className={cn(
                    "flex w-full flex-col rounded-xl border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-accent/50 bg-accent/10"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <span className="font-medium">{loc.name}</span>
                  {loc.secondaryLabel ? (
                    <span className="text-sm text-muted-foreground">
                      {loc.secondaryLabel}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className={settingsAccentSaveButtonClassName}
            disabled={!selectedId || busy || loading}
            onClick={() => void confirm()}
          >
            {busy ? "Verbinden…" : "Verbinden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
