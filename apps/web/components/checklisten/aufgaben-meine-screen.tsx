"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DatePickerField,
  formScheduleTimeInputFullWidthClassName,
} from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  archivePersonalNote,
  completePersonalNote,
  fetchPersonalNotesForRestaurant,
  upsertPersonalNote,
} from "@/lib/supabase/personal-notes-db";
import type { RestaurantPersonalNoteRow } from "@/lib/types/personal-notes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import {
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue,
  ymdAndHmToDatetimeLocal,
  datetimeLocalValueToYmdHm,
} from "@/lib/reservations/datetime-local";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";

function remindLabel(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function AufgabenMeineScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [notes, setNotes] = useState<RestaurantPersonalNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantPersonalNoteRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [remindDate, setRemindDate] = useState<string | null>(null);
  const [remindTime, setRemindTime] = useState("");
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    setProfileId(user?.id ?? null);
    const { data, error } = await fetchPersonalNotesForRestaurant(restaurantId);
    setLoading(false);
    if (error && isMissingSchemaError(error)) {
      setSchemaMissing(true);
      setNotes([]);
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    setSchemaMissing(false);
    setNotes(data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setRemindDate(null);
    setRemindTime("");
    setDrawerOpen(true);
  };

  const openEdit = (note: RestaurantPersonalNoteRow) => {
    setEditing(note);
    setTitle(note.title);
    setBody(note.body ?? "");
    if (note.remind_at) {
      const local = isoToDatetimeLocalValue(note.remind_at);
      const parts = datetimeLocalValueToYmdHm(local);
      setRemindDate(parts?.ymd ?? null);
      setRemindTime(parts?.hm ?? "");
    } else {
      setRemindDate(null);
      setRemindTime("");
    }
    setDrawerOpen(true);
  };

  const openNotes = useMemo(
    () => notes.filter((n) => !n.completed_at),
    [notes],
  );
  const doneNotes = useMemo(
    () => notes.filter((n) => Boolean(n.completed_at)),
    [notes],
  );

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        size="lg"
        className={modulePrimaryAddButtonFullWidthClassName}
        onClick={openNew}
        disabled={schemaMissing || !profileId}
      >
        <Plus className="size-4" />
        Notiz / Erinnerung
      </Button>

      {schemaMissing ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Persönliche Notizen sind noch nicht auf der Datenbank aktiv. Bitte
            Migration anwenden.
          </CardContent>
        </Card>
      ) : showSkeleton ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : openNotes.length === 0 && doneNotes.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine persönlichen Notizen. Nur du siehst diese Einträge.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {openNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={() => openEdit(note)}
              onToggleComplete={async () => {
                const { error } = await completePersonalNote({
                  noteId: note.id,
                  completed: true,
                });
                if (error) toast.error(error);
                else void reload();
              }}
              onArchive={async () => {
                const { error } = await archivePersonalNote({ noteId: note.id });
                if (error) toast.error(error);
                else void reload();
              }}
            />
          ))}
          {doneNotes.length > 0 ? (
            <div className="space-y-2 pt-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">
                Erledigt
              </p>
              {doneNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpen={() => openEdit(note)}
                  onToggleComplete={async () => {
                    const { error } = await completePersonalNote({
                      noteId: note.id,
                      completed: false,
                    });
                    if (error) toast.error(error);
                    else void reload();
                  }}
                  onArchive={async () => {
                    const { error } = await archivePersonalNote({
                      noteId: note.id,
                    });
                    if (error) toast.error(error);
                    else void reload();
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader>
            <DrawerTitle>
              {editing ? "Notiz bearbeiten" : "Neue Notiz"}
            </DrawerTitle>
            <DrawerDescription>
              Nur für dich sichtbar — optional mit Erinnerung.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFormBody>
            <DrawerFormSection>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="personal-note-title">Titel</Label>
                  <Input
                    id="personal-note-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="z. B. Wein bestellen"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="personal-note-body">Notiz</Label>
                  <Textarea
                    id="personal-note-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    maxLength={8000}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Erinnerung Datum</Label>
                    <DatePickerField
                      value={remindDate}
                      onChange={setRemindDate}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="personal-note-time">Uhrzeit</Label>
                    <Input
                      id="personal-note-time"
                      type="time"
                      className={formScheduleTimeInputFullWidthClassName}
                      value={remindTime}
                      onChange={(e) => setRemindTime(e.target.value)}
                      disabled={!remindDate}
                    />
                  </div>
                </div>
              </div>
            </DrawerFormSection>
          </DrawerFormBody>
          <DrawerFormFooter
            onCancel={() => setDrawerOpen(false)}
            onSubmit={async () => {
              if (!restaurantId || !profileId) return;
              const trimmed = title.trim();
              if (!trimmed) {
                toast.error("Titel fehlt");
                return;
              }
              setSaving(true);
              let remind_at: string | null = null;
              if (remindDate && remindTime) {
                const local = ymdAndHmToDatetimeLocal(remindDate, remindTime);
                remind_at = datetimeLocalValueToIso(local);
              } else if (remindDate) {
                const local = ymdAndHmToDatetimeLocal(remindDate, "09:00");
                remind_at = datetimeLocalValueToIso(local);
              }
              const { error } = await upsertPersonalNote({
                restaurantId,
                profileId,
                input: {
                  id: editing?.id,
                  title: trimmed,
                  body,
                  remind_at,
                  completed_at: editing?.completed_at ?? null,
                },
              });
              setSaving(false);
              if (error) {
                toast.error(error);
                return;
              }
              toast.success(editing ? "Gespeichert" : "Notiz angelegt");
              setDrawerOpen(false);
              void reload();
            }}
            submitLabel={editing ? "Speichern" : "Anlegen"}
            submitDisabled={saving}
            submitPending={saving}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function NoteCard({
  note,
  onOpen,
  onToggleComplete,
  onArchive,
}: {
  note: RestaurantPersonalNoteRow;
  onOpen: () => void;
  onToggleComplete: () => void;
  onArchive: () => void;
}) {
  const remind = remindLabel(note.remind_at);
  const done = Boolean(note.completed_at);
  const due =
    !done &&
    note.remind_at &&
    new Date(note.remind_at).getTime() <= Date.now();

  return (
    <Card
      className={cn(
        "border-border/50 shadow-card transition-colors",
        done && "opacity-70",
      )}
    >
      <CardContent className="flex items-start gap-3 py-3">
        <Button
          type="button"
          size="icon-sm"
          variant={done ? "default" : "outline"}
          className="mt-0.5 shrink-0 rounded-full"
          aria-label={done ? "Wieder öffnen" : "Erledigen"}
          onClick={onToggleComplete}
        >
          <Check className="size-3.5" />
        </Button>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onOpen}
        >
          <p
            className={cn(
              "text-sm font-medium",
              done && "line-through text-muted-foreground",
            )}
          >
            {note.title}
          </p>
          {note.body ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {note.body}
            </p>
          ) : null}
          {remind ? (
            <p
              className={cn(
                "mt-1 text-xs",
                due ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              Erinnerung {remind}
              {due ? " · fällig" : ""}
            </p>
          ) : null}
        </button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0 text-muted-foreground"
          aria-label="Löschen"
          onClick={onArchive}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
