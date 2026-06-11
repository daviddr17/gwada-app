"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationContact } from "@/lib/notifications/notification-contact-types";
import {
  fetchNotificationContactClient,
  saveNotificationContactClient,
} from "@/lib/notifications/fetch-notifications-client";
import { toast } from "sonner";

export type NotificationContactDraft = {
  notificationEmail: string;
  phone: string;
};

function contactToDraft(contact: NotificationContact): NotificationContactDraft {
  return {
    notificationEmail: contact.notificationEmail,
    phone: contact.phone,
  };
}

function draftsEqual(a: NotificationContactDraft, b: NotificationContactDraft) {
  return (
    a.notificationEmail.trim() === b.notificationEmail.trim() &&
    a.phone.trim() === b.phone.trim()
  );
}

export function useNotificationContact() {
  const [saved, setSaved] = useState<NotificationContactDraft>({
    notificationEmail: "",
    phone: "",
  });
  const [draft, setDraft] = useState<NotificationContactDraft>({
    notificationEmail: "",
    phone: "",
  });
  const [authEmail, setAuthEmail] = useState("");
  const [effectiveEmail, setEffectiveEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const loadGen = useRef(0);

  const dirty = !draftsEqual(saved, draft);

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    setIsLoading(true);

    const { data, error } = await fetchNotificationContactClient();

    if (gen !== loadGen.current) return;

    if (error || !data) {
      setIsLoading(false);
      if (error) {
        toast.error("Kontaktdaten konnten nicht geladen werden.");
      }
      return;
    }

    const nextDraft = contactToDraft(data);
    setSaved(nextDraft);
    setDraft(nextDraft);
    setAuthEmail(data.authEmail);
    setEffectiveEmail(data.effectiveEmail);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = useCallback((patch: Partial<NotificationContactDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const save = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!dirty) return { ok: true as const };

      setIsSaving(true);
      const { ok, error, field } = await saveNotificationContactClient(draft);
      setIsSaving(false);

      if (!ok) {
        if (!options?.silent) {
          toast.error(error ?? "Speichern fehlgeschlagen.");
        }
        return { ok: false as const, error, field };
      }

      const { data } = await fetchNotificationContactClient();
      if (data) {
        const nextDraft = contactToDraft(data);
        setSaved(nextDraft);
        setDraft(nextDraft);
        setAuthEmail(data.authEmail);
        setEffectiveEmail(data.effectiveEmail);
      } else {
        setSaved(draft);
      }

      if (!options?.silent) {
        toast.success("Kontaktdaten gespeichert.");
      }
      return { ok: true as const };
    },
    [dirty, draft],
  );

  const resetDraft = useCallback(() => {
    setDraft(saved);
  }, [saved]);

  return {
    ready: !isLoading,
    isLoading,
    isSaving,
    dirty,
    draft,
    authEmail,
    effectiveEmail,
    updateDraft,
    save,
    resetDraft,
  };
}
