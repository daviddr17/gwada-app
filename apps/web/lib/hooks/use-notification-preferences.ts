"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import type { NotificationChannelsInfo } from "@/lib/notifications/notification-channels-server";
import {
  fetchNotificationPreferencesClient,
  saveNotificationPreferencesClient,
} from "@/lib/notifications/fetch-notifications-client";
import { dispatchNotificationsRefresh } from "@/lib/notifications/notification-events";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import { toast } from "sonner";

function prefsEqual(a: NotificationPreferences, b: NotificationPreferences) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useNotificationPreferences() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [saved, setSaved] = useState<NotificationPreferences>(
    defaultNotificationPreferences(),
  );
  const [draft, setDraft] = useState<NotificationPreferences>(
    defaultNotificationPreferences(),
  );
  const [channels, setChannels] = useState<NotificationChannelsInfo | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const loadGen = useRef(0);

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  const dirty = !prefsEqual(saved, draft);

  const load = useCallback(async () => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

    const gen = ++loadGen.current;
    setIsLoading(true);

    const { data, error } = await fetchNotificationPreferencesClient(
      restaurantId,
    );

    if (gen !== loadGen.current) return;

    if (error || !data) {
      setIsLoading(false);
      if (error) toast.error("Benachrichtigungen konnten nicht geladen werden.");
      return;
    }

    setSaved(data.preferences);
    setDraft(data.preferences);
    setChannels(data.channels);
    setIsLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!ready) {
      setIsLoading(true);
      return;
    }

    void load();

    const onChange = () => {
      void load();
    };
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onChange,
      );
    };
  }, [ready, load]);

  const updateDraft = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!restaurantId || !dirty) return { ok: true as const };

    setIsSaving(true);
    const { ok, error } = await saveNotificationPreferencesClient({
      restaurantId,
      preferences: draft,
    });
    setIsSaving(false);

    if (!ok) {
      toast.error("Speichern fehlgeschlagen.");
      return { ok: false as const, error };
    }

    setSaved(draft);
    dispatchNotificationsRefresh();
    toast.success("Benachrichtigungen gespeichert.");
    return { ok: true as const };
  }, [restaurantId, dirty, draft]);

  const resetDraft = useCallback(() => {
    setDraft(saved);
  }, [saved]);

  return {
    ready,
    isLoading,
    isSaving,
    dirty,
    draft,
    saved,
    channels,
    updateDraft,
    save,
    resetDraft,
  };
}
