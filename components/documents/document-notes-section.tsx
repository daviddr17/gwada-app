"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { DocumentNotesSkeleton } from "@/components/documents/document-notes-skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  appendRestaurantDocumentNoteEntryClient,
  updateRestaurantDocumentNoteEntryClient,
} from "@/lib/documents/documents-api";
import { fetchDocumentNoteEntries } from "@/lib/supabase/documents-db";
import type { RestaurantDocumentNoteEntry } from "@/lib/types/document-notes";
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

type DocumentNotesSectionProps = {
  open: boolean;
  restaurantId: string;
  documentId: string;
  canEditNotes: boolean;
  onNotesChanged?: () => void;
};

export function DocumentNotesSection({
  open,
  restaurantId,
  documentId,
  canEditNotes,
  onNotesChanged,
}: DocumentNotesSectionProps) {
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<RestaurantDocumentNoteEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const showEntriesSkeleton = useDeferredSkeleton(loadingEntries);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setEditingId(null);
  }, [open, documentId]);

  const reloadEntries = useCallback(async () => {
    if (!restaurantId || !documentId) return;
    setLoadingEntries(true);
    const { data, error } = await fetchDocumentNoteEntries(
      restaurantId,
      documentId,
    );
    setLoadingEntries(false);
    if (error) {
      toast.error("Notizen konnten nicht geladen werden.");
      setEntries([]);
      return;
    }
    setEntries(data);
  }, [restaurantId, documentId]);

  useEffect(() => {
    if (!open || !documentId) return;
    void reloadEntries();
  }, [open, documentId, reloadEntries]);

  const handleAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setAdding(true);
    const { error } = await appendRestaurantDocumentNoteEntryClient({
      restaurantId,
      documentId,
      body: trimmed,
    });
    setAdding(false);
    if (error) {
      toast.error("Notiz konnte nicht hinzugefügt werden.");
      return;
    }
    toast.success("Notiz hinzugefügt");
    setDraft("");
    await reloadEntries();
    onNotesChanged?.();
  };

  const startEdit = (entry: RestaurantDocumentNoteEntry) => {
    setEditingId(entry.id);
    setEditDraft(entry.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async (entryId: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;

    setSavingEdit(true);
    const { error } = await updateRestaurantDocumentNoteEntryClient({
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

  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      <div className="space-y-2">
        <Label htmlFor="doc-note">Notizen</Label>
        <p className="text-xs text-muted-foreground">
          Protokolliert — nachträglich nur mit Berechtigung „Dokument-Notizen
          bearbeiten“ änderbar.
        </p>
      </div>

      {loadingEntries && !showEntriesSkeleton ? (
        <div className="min-h-24" aria-busy="true" />
      ) : null}
      {showEntriesSkeleton ? (
        <DocumentNotesSkeleton />
      ) : entries.length > 0 ? (
        <ul className="max-h-48 space-y-3 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3">
          {entries.map((entry) => {
            const isEditing = editingId === entry.id;
            return (
              <li key={entry.id} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(entry.created_at)}
                    {entry.actor_label ? ` · ${entry.actor_label}` : null}
                  </p>
                  {canEditNotes && !isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground"
                      aria-label="Notiz bearbeiten"
                      onClick={() => startEdit(entry)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
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
                          savingEdit || !editDraft.trim() || editDraft.trim() === entry.body.trim()
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
        <p className="text-xs text-muted-foreground">Noch keine Notizen.</p>
      )}

      <div className="space-y-2">
        <Textarea
          id="doc-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Notiz hinzufügen …"
          rows={2}
          className="resize-y rounded-xl"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("rounded-xl")}
          disabled={!draft.trim() || adding}
          onClick={() => void handleAdd()}
        >
          {adding ? "Hinzufügen …" : "Notiz hinzufügen"}
        </Button>
      </div>
    </div>
  );
}
