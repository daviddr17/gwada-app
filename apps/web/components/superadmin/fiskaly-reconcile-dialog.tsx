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
import type { FiskalyReconcilePreview } from "@/lib/superadmin/fiskaly-provision-api";

export function FiskalyReconcileDialog({
  open,
  onOpenChange,
  preview,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: FiskalyReconcilePreview | null;
  loading?: boolean;
  onConfirm: () => void;
}) {
  const match = preview?.match;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Fiskaly-Standort verknüpfen</DialogTitle>
          <DialogDescription>
            {preview
              ? `Restaurant „${preview.restaurantName}“ — erwartete Serien-Nr.: ${preview.expectedClientSerial}`
              : "Vorschau wird geladen…"}
          </DialogDescription>
        </DialogHeader>

        {match ? (
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-3 text-sm">
            <p className="font-medium">Bei Fiskaly gefunden</p>
            <dl className="grid gap-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>TSS-ID</dt>
                <dd className="font-mono text-foreground">{match.tssId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Client-ID</dt>
                <dd className="font-mono text-foreground">{match.clientId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Serien-Nr.</dt>
                <dd className="font-mono text-foreground">{match.clientSerial}</dd>
              </div>
              {match.tssState ? (
                <div className="flex justify-between gap-3">
                  <dt>TSS-Status</dt>
                  <dd>{match.tssState}</dd>
                </div>
              ) : null}
              {match.clientState ? (
                <div className="flex justify-between gap-3">
                  <dt>Client-Status</dt>
                  <dd>{match.clientState}</dd>
                </div>
              ) : null}
            </dl>
            <p className="pt-1 text-xs text-muted-foreground">
              Es wird kein neuer Standort bei Fiskaly erstellt — nur die IDs in Gwada
              gespeichert und DSFinV-K nachgezogen.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kein passender Client mit der erwarteten Serien-Nr. bei Fiskaly gefunden.
            Prüfe das Fiskaly-Dashboard oder lege den Standort neu an.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!match || loading}
            onClick={onConfirm}
          >
            {loading ? "Wird verknüpft…" : "Verknüpfen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
