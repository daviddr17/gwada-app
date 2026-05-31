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

type MetaPageOption = {
  id: string;
  name: string;
  secondaryLabel: string | null;
};

type PendingPagesResponse = {
  provider: "facebook" | "instagram";
  restaurantId: string;
  pages: MetaPageOption[];
  preselectedPageId: string | null;
};

export function MetaPageSelectDialog({
  provider,
  title,
  open,
  onOpenChange,
  onCompleted,
}: {
  provider: "facebook" | "instagram";
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<MetaPageOption[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/pending-pages`);
      const data = (await res.json()) as PendingPagesResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error === "pending_not_found"
            ? "Die Seitenauswahl ist abgelaufen. Bitte erneut verbinden."
            : `${title}: Seiten konnten nicht geladen werden.`,
        );
        onOpenChange(false);
        return;
      }
      setPages(data.pages);
      setSelectedPageId(data.preselectedPageId);
    } catch {
      toast.error(`Netzwerkfehler (${title}).`);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [provider, title, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    void loadPages();
  }, [open, loadPages]);

  const confirm = async () => {
    if (!selectedPageId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedPageId }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(data.error ?? "Verbinden fehlgeschlagen.");
        return;
      }
      toast.success(`${title} verbunden.`);
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error(`Netzwerkfehler (${title}).`);
    } finally {
      setBusy(false);
    }
  };

  const pageLabel =
    provider === "instagram" ? "Instagram-Konto" : "Facebook-Seite";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pageLabel} auswählen</DialogTitle>
          <DialogDescription>
            Meta hat mehrere Seiten freigegeben. Wähle die passende Seite für
            dieses Restaurant.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground" aria-busy>
            Seiten werden geladen…
          </p>
        ) : (
          <ul className="space-y-2" role="listbox" aria-label={pageLabel}>
            {pages.map((page) => {
              const selected = selectedPageId === page.id;
              return (
                <li key={page.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full flex-col rounded-xl border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-ring ring-2 ring-ring/30 bg-accent/5"
                        : "border-border/50 hover:border-border hover:bg-muted/40",
                    )}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <span className="font-medium text-foreground">
                      {page.name}
                    </span>
                    {page.secondaryLabel ? (
                      <span className="text-sm text-muted-foreground">
                        {page.secondaryLabel}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      ID {page.id}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className={cn("h-11 rounded-xl", settingsAccentSaveButtonClassName)}
            disabled={busy || loading || !selectedPageId}
            onClick={() => void confirm()}
          >
            {busy ? "Verbinden…" : "Verbinden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
