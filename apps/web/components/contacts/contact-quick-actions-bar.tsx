"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, MessageSquare, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactMessagesDrawer } from "@/components/contacts/contact-messages-drawer";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { insertContactNote } from "@/lib/supabase/contact-notes-db";
import { contactDisplayName, type ContactDetail } from "@/lib/supabase/contacts-db";
import { cn } from "@/lib/utils";

export function ContactQuickActionsBar({
  restaurantId,
  contact,
  onNoteAdded,
}: {
  restaurantId: string;
  contact: ContactDetail;
  onNoteAdded?: () => void;
}) {
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const contactName = contactDisplayName(contact);

  const handleAddNote = async () => {
    const body = noteBody.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    const { error } = await insertContactNote({
      restaurantId,
      contactId: contact.id,
      body,
    });
    setSavingNote(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notiz hinzugefügt.");
    setNoteBody("");
    setNoteOpen(false);
    onNoteAdded?.();
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl"
          onClick={() => setMessagesOpen(true)}
        >
          <MessageSquare className="size-3.5" />
          Nachricht senden
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl"
          render={
            <Link
              href={`/dashboard/reservierungen/uebersicht?new=1&contact=${contact.id}`}
              prefetch
            />
          }
        >
          <CalendarPlus className="size-3.5" />
          Reservierung anlegen
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl"
          onClick={() => setNoteOpen((v) => !v)}
        >
          <StickyNote className="size-3.5" />
          Notiz hinzufügen
        </Button>
      </div>

      {noteOpen ? (
        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
          <Input
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Kurze Notiz …"
            className="h-10 rounded-xl text-sm"
            disabled={savingNote}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddNote();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={savingNote}
              onClick={() => {
                setNoteOpen(false);
                setNoteBody("");
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn("h-8 rounded-xl", brandActionButtonRoundedClassName)}
              disabled={savingNote || !noteBody.trim()}
              onClick={() => void handleAddNote()}
            >
              Speichern
            </Button>
          </div>
        </div>
      ) : null}

      <ContactMessagesDrawer
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        restaurantId={restaurantId}
        contactId={contact.id}
        contactName={contactName}
      />
    </>
  );
}
