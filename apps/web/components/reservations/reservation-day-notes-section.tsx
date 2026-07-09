"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import {
  appendReservationDayNoteEntryClient,
  deleteReservationDayNoteEntryClient,
  updateReservationDayNoteEntryClient,
} from "@/lib/reservations/reservation-day-notes-api";
import { fetchReservationDayNoteEntries } from "@/lib/supabase/reservation-day-notes-db";
import type { RestaurantReservationDayNoteEntry } from "@/lib/types/reservation-day-notes";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { cn } from "@/lib/utils";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

type ReservationDayNotesSectionProps = {
  open: boolean;
  restaurantId: string | null;
  serviceDate: string | null;
  onNotesChanged?: () => void;
  className?: string;
};

export function ReservationDayNotesSection({
  open,
  restaurantId,
  serviceDate,
  onNotesChanged,
  className,
}: ReservationDayNotesSectionProps) {
  const { user } = useWorkspaceAuthSession();
  const currentUserId = user?.id ?? null;

  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<RestaurantReservationDayNoteEntry[]>(
    [],
  );
  const [loadingEntries, setLoadingEntries] = useState(false);
  const showEntriesSkeleton = useDeferredSkeleton(loadingEntries);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<RestaurantReservationDayNoteEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setEditingId(null);
    setDeleteTarget(null);
  }, [open, serviceDate]);

  const reloadEntries = useCallback(async () => {
    if (!restaurantId || !serviceDate) return;
    setLoadingEntries(true);
    const { data, error } = await fetchReservationDayNoteEntries(
      restaurantId,
      serviceDate,
    );
    setLoadingEntries(false);
    if (error) {
      toast.error("Tagesnotizen konnten nicht geladen werden.");
      setEntries([]);
      return;
    }
    setEntries(data);
  }, [restaurantId, serviceDate]);

  useEffect(() => {
    if (!open || !restaurantId || !serviceDate) return;
    void reloadEntries();
  }, [open, restaurantId, serviceDate, reloadEntries]);

  const handleAdd = async () => {
    if (!restaurantId || !serviceDate) return;
    const trimmed = draft.trim();
    if (!trimmed) return;

    setAdding(true);
    const { error } = await appendReservationDayNoteEntryClient({
      restaurantId,
      serviceDate,
      body: trimmed,
    });
    setAdding(false);
    if (error) {
      toast.error("Notiz konnte nicht hinzugefügt werden.");
      return;
    }
    toast.success("Tagesnotiz hinzugefügt");
    setDraft("");
    await reloadEntries();
    onNotesChanged?.();
  };

  const startEdit = (entry: RestaurantReservationDayNoteEntry) => {
    setEditingId(entry.id);
    setEditDraft(entry.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async (entryId: string) => {
    if (!restaurantId) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;

    setSavingEdit(true);
    const { error } = await updateReservationDayNoteEntryClient({
      restaurantId,
      entryId,
      body: trimmed,
    });
    setSavingEdit(false);
    if (error) {
      toast.error("Notiz konnte nicht gespeichert werden.");
      return;
    }
    toast.success("Notiz gespeichert");
    cancelEdit();
    await reloadEntries();
    onNotesChanged?.();
  };

  const handleDelete = async () => {
    if (!restaurantId || !deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteReservationDayNoteEntryClient({
      restaurantId,
      entryId: deleteTarget.id,
    });
    setDeleting(false);
    if (error) {
      toast.error("Notiz konnte nicht gelöscht werden.");
      return;
    }
    toast.success("Notiz gelöscht");
    setDeleteTarget(null);
    await reloadEntries();
    onNotesChanged?.();
  };

  if (!restaurantId || !serviceDate) return null;

  return (
    <>
      <div className={cn("space-y-4 border-b border-border/50 pb-4", className)}>
        <div className="space-y-1">
          <Label htmlFor="res-day-note">Tagesnotizen</Label>
          <p className="text-xs text-muted-foreground">
            Protokoll für dieses Datum — jede Person kann eigene Einträge
            bearbeiten und löschen.
          </p>
        </div>

        {loadingEntries && !showEntriesSkeleton ? (
          <div className="min-h-16" aria-busy="true" />
        ) : null}
        {showEntriesSkeleton ? (
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : entries.length > 0 ? (
          <ul className="max-h-48 space-y-3 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3">
            {entries.map((entry) => {
              const isEditing = editingId === entry.id;
              const isOwn = currentUserId === entry.actor_user_id;
              const edited =
                entry.updated_at &&
                entry.updated_at !== entry.created_at;
              return (
                <li key={entry.id} className="text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatWhen(entry.created_at)}
                      {edited ? " · bearbeitet" : null}
                      {entry.actor_label ? ` · ${entry.actor_label}` : null}
                    </p>
                    {isOwn && !isEditing ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground"
                          aria-label="Notiz bearbeiten"
                          onClick={() => startEdit(entry)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground"
                          aria-label="Notiz löschen"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <div className="mt-1.5 space-y-2">
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="resize-y rounded-xl text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          disabled={
                            savingEdit ||
                            !editDraft.trim() ||
                            editDraft.trim() === entry.body.trim()
                          }
                          onClick={() => void handleSaveEdit(entry.id)}
                        >
                          {savingEdit ? "Speichern …" : "Speichern"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          disabled={savingEdit}
                          onClick={cancelEdit}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap">{entry.body}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Noch keine Tagesnotizen.</p>
        )}

        <div className="space-y-2">
          <Textarea
            id="res-day-note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tagesnotiz hinzufügen …"
            rows={2}
            className="resize-y rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={!draft.trim() || adding}
            onClick={() => void handleAdd()}
          >
            {adding ? "Hinzufügen …" : "Notiz hinzufügen"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Tagesnotiz löschen?"
        description="Diese Notiz wird unwiderruflich entfernt."
        confirmLabel={deleting ? "Löschen …" : "Löschen"}
        confirmDisabled={deleting}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
