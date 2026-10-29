"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  completePersonalNote,
  fetchPersonalNotesWithReminders,
  markPersonalNoteRemindedClient,
} from "@/lib/supabase/personal-notes-db";
import type { RestaurantPersonalNoteRow } from "@/lib/types/personal-notes";
import {
  nextPersonalReminderDelayMs,
  personalReminderPopupNotesFromRows,
  type PersonalReminderPopupNote,
} from "@/lib/personal-notes/personal-reminder-due";
import {
  defaultNotificationPreferences,
  isInAppModuleEnabled,
} from "@/lib/notifications/notification-preferences";
import { fetchNotificationPreferencesClient } from "@/lib/notifications/fetch-notifications-client";
import { dispatchNotificationsRefresh } from "@/lib/notifications/notification-events";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";

const RESCAN_MS = 45_000;

export function usePersonalReminderPopup() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [active, setActive] = useState<PersonalReminderPopupNote | null>(null);
  const [busy, setBusy] = useState(false);
  const notesRef = useRef<RestaurantPersonalNoteRow[]>([]);
  const inAppEnabledRef = useRef(true);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);
  const rescanRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const presentDue = useCallback(() => {
    if (!inAppEnabledRef.current) {
      setActive(null);
      activeIdRef.current = null;
      return;
    }
    if (activeIdRef.current) return;

    const due = personalReminderPopupNotesFromRows(notesRef.current).filter(
      (note) => !shownIdsRef.current.has(note.id),
    );
    const next = due[0] ?? null;
    if (!next) {
      setActive(null);
      activeIdRef.current = null;
      return;
    }
    shownIdsRef.current.add(next.id);
    activeIdRef.current = next.id;
    setActive(next);
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimer();
    if (!inAppEnabledRef.current) return;
    const delay = nextPersonalReminderDelayMs(notesRef.current);
    if (delay == null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      presentDue();
      scheduleNext();
    }, Math.max(delay, 250));
  }, [clearTimer, presentDue]);

  const reload = useCallback(async () => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

    const [prefsRes, notesRes] = await Promise.all([
      fetchNotificationPreferencesClient(restaurantId),
      fetchPersonalNotesWithReminders(restaurantId),
    ]);

    const prefs =
      prefsRes.data?.preferences ?? defaultNotificationPreferences();
    inAppEnabledRef.current = isInAppModuleEnabled(prefs, "personal_reminder");

    if (notesRes.error && isMissingSchemaError(notesRes.error)) {
      notesRef.current = [];
      clearTimer();
      setActive(null);
      activeIdRef.current = null;
      return;
    }
    if (notesRes.error) {
      console.warn("[personal-reminder-popup]", notesRes.error);
      return;
    }

    notesRef.current = notesRes.data;
    if (!inAppEnabledRef.current) {
      clearTimer();
      setActive(null);
      activeIdRef.current = null;
      return;
    }

    presentDue();
    scheduleNext();
  }, [restaurantId, clearTimer, presentDue, scheduleNext]);

  useEffect(() => {
    if (!ready) return;

    void reload();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const onRestaurantChanged = () => {
      shownIdsRef.current.clear();
      activeIdRef.current = null;
      setActive(null);
      void reload();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onRestaurantChanged,
    );
    rescanRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, RESCAN_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onRestaurantChanged,
      );
      clearTimer();
      if (rescanRef.current != null) {
        window.clearInterval(rescanRef.current);
        rescanRef.current = null;
      }
    };
  }, [ready, reload, clearTimer]);

  const dismissActive = useCallback(() => {
    const id = activeIdRef.current;
    setActive(null);
    activeIdRef.current = null;
    if (id) {
      notesRef.current = notesRef.current.filter((row) => row.id !== id);
    }
    presentDue();
    scheduleNext();
  }, [presentDue, scheduleNext]);

  const acknowledge = useCallback(async () => {
    if (!active || busy) return;
    setBusy(true);
    const { error } = await markPersonalNoteRemindedClient({
      noteId: active.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    dispatchNotificationsRefresh();
    dismissActive();
  }, [active, busy, dismissActive]);

  const complete = useCallback(async () => {
    if (!active || busy) return;
    setBusy(true);
    const completeRes = await completePersonalNote({
      noteId: active.id,
      completed: true,
    });
    if (completeRes.error) {
      setBusy(false);
      toast.error(completeRes.error);
      return;
    }
    const { error } = await markPersonalNoteRemindedClient({
      noteId: active.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    dispatchNotificationsRefresh();
    dismissActive();
  }, [active, busy, dismissActive]);

  return {
    active,
    busy,
    open: Boolean(active),
    acknowledge,
    complete,
    onOpenChange: (open: boolean) => {
      if (!open && active && !busy) {
        void acknowledge();
      }
    },
  };
}
