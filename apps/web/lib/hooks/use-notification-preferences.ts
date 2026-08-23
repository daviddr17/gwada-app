"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultNotificationPreferences,
  deriveChannelFlagsFromModules,
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

const PREFERENCES_AUTOSAVE_MS = 350;

function prefsEqual(a: NotificationPreferences, b: NotificationPreferences) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergePreferencesPatch(
  prev: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  const next: NotificationPreferences = {
    ...prev,
    ...patch,
    inAppModules: patch.inAppModules
      ? { ...prev.inAppModules, ...patch.inAppModules }
      : prev.inAppModules,
    pushWhatsappModules: patch.pushWhatsappModules
      ? { ...prev.pushWhatsappModules, ...patch.pushWhatsappModules }
      : prev.pushWhatsappModules,
    pushEmailModules: patch.pushEmailModules
      ? { ...prev.pushEmailModules, ...patch.pushEmailModules }
      : prev.pushEmailModules,
  };

  if (
    patch.pushWhatsappModules ||
    patch.pushEmailModules ||
    patch.channelWhatsappEnabled !== undefined ||
    patch.channelEmailEnabled !== undefined
  ) {
    const channels = deriveChannelFlagsFromModules(next);
    next.channelWhatsappEnabled = channels.channelWhatsappEnabled;
    next.channelEmailEnabled = channels.channelEmailEnabled;
  }

  return next;
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
  const confirmedRef = useRef<NotificationPreferences>(
    defaultNotificationPreferences(),
  );
  const draftRef = useRef<NotificationPreferences>(
    defaultNotificationPreferences(),
  );
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());

  const ready =
    workspaceReady &&
    Boolean(restaurantId && isUuidRestaurantId(restaurantId));

  const dirty = !prefsEqual(saved, draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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

    confirmedRef.current = data.preferences;
    draftRef.current = data.preferences;
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

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const persistPreferences = useCallback(() => {
    if (!restaurantId || !isUuidRestaurantId(restaurantId)) return;

    persistChainRef.current = persistChainRef.current.then(async () => {
      while (
        !prefsEqual(draftRef.current, confirmedRef.current) &&
        restaurantId &&
        isUuidRestaurantId(restaurantId)
      ) {
        const toSave = draftRef.current;
        const rollback = confirmedRef.current;

        setIsSaving(true);
        const { ok, data } = await saveNotificationPreferencesClient({
          restaurantId,
          preferences: toSave,
        });
        setIsSaving(false);

        if (!ok) {
          confirmedRef.current = rollback;
          draftRef.current = rollback;
          setSaved(rollback);
          setDraft(rollback);
          toast.error("Speichern fehlgeschlagen.");
          break;
        }

        const next = data?.preferences ?? toSave;
        confirmedRef.current = next;
        if (data?.channels) setChannels(data.channels);
        dispatchNotificationsRefresh();

        if (prefsEqual(draftRef.current, toSave)) {
          draftRef.current = next;
          setSaved(next);
          setDraft(next);
        }
      }
    });
  }, [restaurantId]);

  const schedulePersist = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      persistPreferences();
    }, PREFERENCES_AUTOSAVE_MS);
  }, [persistPreferences]);

  const patchPreferences = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      const next = mergePreferencesPatch(draftRef.current, patch);
      draftRef.current = next;
      setDraft(next);
      setSaved(next);
      schedulePersist();
    },
    [schedulePersist],
  );

  const updateDraft = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      patchPreferences(patch);
    },
    [patchPreferences],
  );

  const save = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!restaurantId) return { ok: true as const };

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      if (!prefsEqual(draftRef.current, confirmedRef.current)) {
        await persistPreferences();
      }

      if (!prefsEqual(draftRef.current, confirmedRef.current)) {
        if (!options?.silent) {
          toast.error("Speichern fehlgeschlagen.");
        }
        return { ok: false as const };
      }

      if (!options?.silent) {
        toast.success("Benachrichtigungen gespeichert.");
      }
      return { ok: true as const };
    },
    [restaurantId, persistPreferences],
  );

  const resetDraft = useCallback(() => {
    const confirmed = confirmedRef.current;
    draftRef.current = confirmed;
    setDraft(confirmed);
    setSaved(confirmed);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  return {
    ready,
    isLoading,
    isSaving,
    dirty,
    draft,
    saved,
    channels,
    updateDraft,
    patchPreferences,
    save,
    reload: load,
    resetDraft,
  };
}
