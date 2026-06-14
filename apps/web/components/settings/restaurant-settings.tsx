"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField, formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SettingsBrandingCard } from "@/components/settings/settings-branding-panel";
import { RestaurantProfileHeader } from "@/components/settings/restaurant-profile-header";
import { RestaurantSettingsSkeleton } from "@/components/settings/restaurant-settings-skeleton";
import { WeekdayHoursGrid } from "@/components/settings/weekday-hours-grid";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { IntegrationPlatformSyncButton } from "@/components/settings/integration-platform-sync-button";
import { OpeningHoursHolidaySuggestions } from "@/components/settings/opening-hours-holiday-suggestions";
import { OpeningHoursPlatformSyncToggles } from "@/components/settings/opening-hours-platform-sync-toggles";
import {
  OpeningHoursPlatformSyncStatusBadge,
  OpeningHoursPlatformSyncStatusRow,
} from "@/components/settings/opening-hours-platform-sync-status";
import {
  integrationPlatformSyncLabel,
  integrationSyncSuccessMessage,
  postIntegrationPlatformSync,
} from "@/lib/integrations/integration-platform-sync-client";
import { integrationSyncErrorMessage } from "@/lib/integrations/integration-sync-user-messages";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useOpeningHoursPlatformStatus } from "@/lib/hooks/use-opening-hours-platform-status";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import {
  defaultOpeningHoursSettingsRow,
  fetchOpeningHoursSettingsForRestaurant,
  upsertOpeningHoursSettingsForRestaurant,
  type OpeningHoursSettingsRow,
} from "@/lib/supabase/opening-hours-settings-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";
import { WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import { OPENING_HOURS_EMBED_FOOTER_MAX } from "@/lib/constants/opening-hours-embed";
import {
  publicSurfaceEmbedOnlyDescription,
  publicSurfaceScopeHint,
} from "@/lib/ui/public-surface-settings-copy";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import {
  normalizeProfileForSave,
  validateOpeningHours,
  validateRestaurantStammdaten,
} from "@/lib/restaurant/profile-utils";
import {
  defaultExceptionDateString,
  todayDateString,
} from "@/lib/restaurant/date-exception-utils";
import type {
  DateHoursException,
  RestaurantProfile,
  Weekday,
} from "@/lib/types/restaurant";

function cloneProfile(p: RestaurantProfile): RestaurantProfile {
  const weeklyHours = { ...p.weeklyHours };
  const kitchenWeeklyHours = { ...p.kitchenWeeklyHours };
  for (const d of WEEKDAY_ORDER) {
    weeklyHours[d] = { ...p.weeklyHours[d] };
    kitchenWeeklyHours[d] = { ...p.kitchenWeeklyHours[d] };
  }
  return {
    ...p,
    weeklyHours,
    kitchenWeeklyHours,
    dateExceptions: p.dateExceptions.map((ex) => ({ ...ex })),
  };
}

function newException(): DateHoursException {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ex-${Date.now()}`,
    date: defaultExceptionDateString(),
    closed: false,
    open: "11:30",
    close: "22:00",
    note: "",
  };
}

function pickStammdaten(p: RestaurantProfile) {
  return {
    slug: p.slug,
    name: p.name,
    street: p.street,
    postalCode: p.postalCode,
    city: p.city,
    country: p.country,
    website: p.website,
    phone: p.phone,
    vatNumber: p.vatNumber,
  };
}

export type RestaurantSettingsSection = "restaurant" | "hours";

export function RestaurantSettingsPanel({
  section,
}: {
  section: RestaurantSettingsSection;
}) {
  const { profile, saveProfile, saveOpeningHours, patchProfile, isReady } = useRestaurantProfile();
  const { accentHex, persistAccentHex, isReady: accentReady } = useAccentColor();
  const [draft, setDraft] = useState<RestaurantProfile | null>(null);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT_HEX);
  const [error, setError] = useState<string | null>(null);
  const [accentError, setAccentError] = useState<string | null>(null);
  const [savedRestaurantFlash, setSavedRestaurantFlash] = useState(false);
  const [savedHoursFlash, setSavedHoursFlash] = useState(false);
  const [showPastExceptions, setShowPastExceptions] = useState(false);
  const [exceptionDeleteId, setExceptionDeleteId] = useState<string | null>(null);
  const [platformStatusRefresh, setPlatformStatusRefresh] = useState(0);
  const [openingHoursSettings, setOpeningHoursSettings] =
    useState<OpeningHoursSettingsRow>(defaultOpeningHoursSettingsRow);
  const [savedOpeningHoursSettings, setSavedOpeningHoursSettings] =
    useState<OpeningHoursSettingsRow>(defaultOpeningHoursSettingsRow);

  const pendingExceptionDateLabel = useMemo(() => {
    if (!exceptionDeleteId || !draft) return "";
    const ex = draft.dateExceptions.find((e) => e.id === exceptionDeleteId);
    if (!ex) return "";
    try {
      return new Date(`${ex.date}T12:00:00`).toLocaleDateString("de-DE", {
        dateStyle: "medium",
      });
    } catch {
      return ex.date;
    }
  }, [exceptionDeleteId, draft]);

  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => {
      setDraft(cloneProfile(profile));
      setError(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [isReady, profile]);

  useEffect(() => {
    if (!accentReady) return;
    const frame = requestAnimationFrame(() => setAccentDraft(accentHex));
    return () => cancelAnimationFrame(frame);
  }, [accentHex, accentReady]);

  const bumpPlatformStatus = () => setPlatformStatusRefresh((n) => n + 1);

  const updateDay = (day: Weekday, patch: Partial<RestaurantProfile["weeklyHours"][Weekday]>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        weeklyHours: {
          ...prev.weeklyHours,
          [day]: { ...prev.weeklyHours[day], ...patch },
        },
      };
    });
  };

  const updateKitchenDay = (
    day: Weekday,
    patch: Partial<RestaurantProfile["kitchenWeeklyHours"][Weekday]>,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        kitchenWeeklyHours: {
          ...prev.kitchenWeeklyHours,
          [day]: { ...prev.kitchenWeeklyHours[day], ...patch },
        },
      };
    });
  };

  const updateException = (
    id: string,
    patch: Partial<DateHoursException>,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dateExceptions: prev.dateExceptions.map((ex) =>
          ex.id === id ? { ...ex, ...patch } : ex,
        ),
      };
    });
  };

  const removeException = (id: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dateExceptions: prev.dateExceptions.filter((ex) => ex.id !== id),
      };
    });
  };

  const exceptionsVisible = useMemo(() => {
    if (!draft) return [];
    const today = todayDateString();
    const sorted = [...draft.dateExceptions].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    if (showPastExceptions) return sorted;
    return sorted.filter((ex) => ex.date >= today);
  }, [draft?.dateExceptions, showPastExceptions]);

  const hiddenPastCount = useMemo(() => {
    if (!draft || showPastExceptions) return 0;
    const today = todayDateString();
    return draft.dateExceptions.filter((ex) => ex.date < today).length;
  }, [draft?.dateExceptions, showPastExceptions]);

  const stammdatenDirty = useMemo(() => {
    if (!draft || !isReady) return false;
    return (
      JSON.stringify(pickStammdaten(draft)) !==
      JSON.stringify(pickStammdaten(profile))
    );
  }, [draft, profile, isReady]);

  const brandingDirty = useMemo(() => {
    if (!accentReady) return false;
    return normalizeHex(accentDraft) !== normalizeHex(accentHex);
  }, [accentDraft, accentHex, accentReady]);

  const overviewDirty = stammdatenDirty || brandingDirty;

  const handleSaveOverview = async () => {
    if (!draft) return;

    const saveStammdaten = stammdatenDirty;
    const saveBranding = brandingDirty;
    if (!saveStammdaten && !saveBranding) return;

    if (saveStammdaten) {
      const normalized = normalizeProfileForSave(draft);
      const msg = validateRestaurantStammdaten(normalized);
      if (msg) {
        setError(msg);
        return;
      }
    }

    if (saveBranding) {
      const normalizedAccent = normalizeHex(accentDraft);
      if (!normalizedAccent) {
        setAccentError("Ungültiger Hex-Wert (z. B. #eab308)");
        return;
      }
      setAccentError(null);
    }

    setError(null);

    const notifyTogether = saveStammdaten && saveBranding;

    if (saveStammdaten) {
      const normalized = normalizeProfileForSave(draft);
      const ok = await saveProfile(
        { ...normalized, id: draft.id },
        { notify: !notifyTogether },
      );
      if (!ok) return;
    }

    if (saveBranding) {
      const normalizedAccent = normalizeHex(accentDraft)!;
      const ok = await persistAccentHex(normalizedAccent, {
        notify: !notifyTogether,
      });
      if (!ok) return;
    }

    if (notifyTogether) {
      toast.success("Gespeichert");
    }

    setSavedRestaurantFlash(true);
    window.setTimeout(() => setSavedRestaurantFlash(false), 2000);
  };

  const hoursDirty = useMemo(() => {
    if (!draft || !isReady) return false;
    return (
      JSON.stringify(draft.weeklyHours) !==
        JSON.stringify(profile.weeklyHours) ||
      JSON.stringify(draft.dateExceptions) !==
        JSON.stringify(profile.dateExceptions) ||
      draft.kitchenHoursEnabled !== profile.kitchenHoursEnabled ||
      JSON.stringify(draft.kitchenWeeklyHours) !==
        JSON.stringify(profile.kitchenWeeklyHours) ||
      openingHoursSettings.embedFooterText !==
        savedOpeningHoursSettings.embedFooterText
    );
  }, [draft, profile, isReady, openingHoursSettings, savedOpeningHoursSettings]);

  const addException = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dateExceptions: [...prev.dateExceptions, newException()],
      };
    });
  };

  const addHolidayException = (date: string, name: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.dateExceptions.some((ex) => ex.date === date)) return prev;
      return {
        ...prev,
        dateExceptions: [
          ...prev.dateExceptions,
          {
            id:
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `ex-${Date.now()}`,
            date,
            closed: true,
            note: name,
          },
        ],
      };
    });
  };

  const existingExceptionDates = useMemo(() => {
    if (!draft) return new Set<string>();
    return new Set(draft.dateExceptions.map((ex) => ex.date));
  }, [draft?.dateExceptions]);

  const hasFutureExceptions = useMemo(() => {
    if (!draft) return false;
    const today = todayDateString();
    return draft.dateExceptions.some((ex) => ex.date >= today);
  }, [draft?.dateExceptions]);

  const awaitingDraft = !isReady || draft === null;
  const showSkeleton = useDeferredSkeleton(awaitingDraft);
  const { restaurantId: workspaceRestaurantId } = useWorkspaceRestaurantUuid();

  const persistOpeningHoursSettings = useCallback(
    async (
      next: OpeningHoursSettingsRow,
      opts?: { silent?: boolean },
    ): Promise<boolean> => {
      if (!workspaceRestaurantId) return false;
      const result = await upsertOpeningHoursSettingsForRestaurant(
        workspaceRestaurantId,
        next,
      );
      if (!result.ok) {
        if (!opts?.silent) {
          setError(result.error);
        }
        return false;
      }
      setOpeningHoursSettings(next);
      setSavedOpeningHoursSettings(next);
      return true;
    },
    [workspaceRestaurantId],
  );

  const updateOpeningHoursSyncToggle = useCallback(
    (patch: Pick<
      OpeningHoursSettingsRow,
      "syncGoogleOnSave" | "syncFacebookOnSave"
    >) => {
      const next = { ...openingHoursSettings, ...patch };
      setOpeningHoursSettings(next);
      if (!workspaceRestaurantId) return;
      void persistOpeningHoursSettings(next, { silent: true });
    },
    [
      openingHoursSettings,
      workspaceRestaurantId,
      persistOpeningHoursSettings,
    ],
  );

  useEffect(() => {
    if (section !== "hours" || !workspaceRestaurantId) return;
    let cancelled = false;
    void (async () => {
      const row = await fetchOpeningHoursSettingsForRestaurant(
        workspaceRestaurantId,
      );
      if (cancelled) return;
      setOpeningHoursSettings(row);
      setSavedOpeningHoursSettings(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [section, workspaceRestaurantId]);
  const {
    loading: platformConnectionsLoading,
    googleConnected,
    facebookConnected,
  } = useReviewPlatformConnections(workspaceRestaurantId);
  const { data: platformHoursStatus, loading: platformHoursStatusLoading } =
    useOpeningHoursPlatformStatus(
      workspaceRestaurantId,
      platformStatusRefresh,
    );

  const syncOpeningHoursToPlatforms = async (restaurantId: string) => {
    const targets: Array<{
      target: "opening_hours_google" | "opening_hours_facebook";
      enabled: boolean;
      connected: boolean;
    }> = [
      {
        target: "opening_hours_google",
        enabled: openingHoursSettings.syncGoogleOnSave,
        connected: googleConnected,
      },
      {
        target: "opening_hours_facebook",
        enabled: openingHoursSettings.syncFacebookOnSave,
        connected: facebookConnected,
      },
    ];

    for (const { target, enabled, connected } of targets) {
      if (!enabled || !connected) continue;
      const label = integrationPlatformSyncLabel(target);
      try {
        const result = await postIntegrationPlatformSync(target, restaurantId);
        if (!result.ok) {
          toast.error(
            `${label}: ${integrationSyncErrorMessage(result.error)}`,
          );
          continue;
        }
        toast.success(
          `${label}: ${integrationSyncSuccessMessage(target, result.itemCount)}`,
        );
      } catch {
        toast.error(`${label}: Übertragung fehlgeschlagen.`);
      }
    }
  };

  const handleSaveHours = async () => {
    if (!draft) return;
    const normalized = normalizeProfileForSave(draft);
    const msg = validateOpeningHours(normalized);
    if (msg) {
      setError(msg);
      return;
    }
    const footerTrim = openingHoursSettings.embedFooterText.trim();
    if (footerTrim.length > OPENING_HOURS_EMBED_FOOTER_MAX) {
      setError(
        `Hinweistext: maximal ${OPENING_HOURS_EMBED_FOOTER_MAX} Zeichen.`,
      );
      return;
    }
    setError(null);
    const ok = await saveOpeningHours({ ...normalized, id: draft.id });
    if (!ok) return;

    if (workspaceRestaurantId) {
      const settingsResult = await persistOpeningHoursSettings({
        ...openingHoursSettings,
        embedFooterText: footerTrim,
      });
      if (!settingsResult) {
        return;
      }
    }

    setDraft(cloneProfile({ ...normalized, id: draft.id }));
    setSavedHoursFlash(true);
    setPlatformStatusRefresh((n) => n + 1);
    window.setTimeout(() => setSavedHoursFlash(false), 2000);

    if (workspaceRestaurantId) {
      await syncOpeningHoursToPlatforms(workspaceRestaurantId);
      setPlatformStatusRefresh((n) => n + 1);
    }
  };

  if (!draft) {
    if (showSkeleton && awaitingDraft) {
      return <RestaurantSettingsSkeleton section={section} />;
    }
    return (
      <div
        className="min-h-[22rem] w-full"
        aria-busy="true"
        aria-label="Restaurantdaten werden geladen"
      />
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {section === "restaurant" && (
      <section>
        <form
          className="flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveOverview();
          }}
        >
        <div className="flex flex-col gap-6">
        <RestaurantProfileHeader
          restaurantId={draft.id}
          name={draft.name}
          slug={draft.slug}
          avatarStoragePath={profile.avatarStoragePath}
          coverStoragePath={profile.coverStoragePath}
          onNameChange={(name) =>
            setDraft((p) => (p ? { ...p, name } : p))
          }
          onSlugChange={(slug) =>
            setDraft((p) => (p ? { ...p, slug } : p))
          }
          onImagePathsChange={(paths) => {
            patchProfile(paths);
            setDraft((p) => (p ? { ...p, ...paths } : p));
          }}
        />
        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Adresse & Kontakt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rs-street">Straße & Hausnummer</Label>
            <Input
              id="rs-street"
              value={draft.street}
              onChange={(e) =>
                setDraft((p) => (p ? { ...p, street: e.target.value } : p))
              }
              placeholder="Musterstraße 1"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rs-zip">PLZ</Label>
              <Input
                id="rs-zip"
                value={draft.postalCode}
                onChange={(e) =>
                  setDraft((p) =>
                    p ? { ...p, postalCode: e.target.value } : p,
                  )
                }
                placeholder="10115"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rs-city">Ort</Label>
              <Input
                id="rs-city"
                value={draft.city}
                onChange={(e) =>
                  setDraft((p) => (p ? { ...p, city: e.target.value } : p))
                }
                placeholder="Berlin"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rs-country">Land</Label>
            <Input
              id="rs-country"
              value={draft.country}
              onChange={(e) =>
                setDraft((p) => (p ? { ...p, country: e.target.value } : p))
              }
              placeholder="Deutschland"
              className="h-11 rounded-xl"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="rs-web">Website</Label>
            <Input
              id="rs-web"
              type="url"
              inputMode="url"
              value={draft.website}
              onChange={(e) =>
                setDraft((p) => (p ? { ...p, website: e.target.value } : p))
              }
              placeholder="https://…"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rs-phone">Telefon</Label>
            <Input
              id="rs-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) =>
                setDraft((p) => (p ? { ...p, phone: e.target.value } : p))
              }
              placeholder="+49 30 1234567"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rs-vat">USt-IdNr.</Label>
            <Input
              id="rs-vat"
              value={draft.vatNumber}
              onChange={(e) =>
                setDraft((p) => (p ? { ...p, vatNumber: e.target.value } : p))
              }
              placeholder="DE123456789"
              className="h-11 rounded-xl"
              autoComplete="off"
            />
          </div>
        </CardContent>
      </Card>
        <SettingsBrandingCard
          draft={accentDraft}
          onDraftChange={setAccentDraft}
          savedHex={accentHex}
          error={accentError}
        />
        </div>
        <SettingsStickySaveBar show={overviewDirty}>
          <Button
            type="submit"
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            {savedRestaurantFlash ? "Gespeichert" : "Restaurantdaten speichern"}
          </Button>
        </SettingsStickySaveBar>
        </form>
      </section>
      )}

      {section === "hours" && (
      <section>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveHours();
          }}
        >
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Restaurant-Öffnungszeiten</CardTitle>
            <CardDescription>
              Regulärer Wochenplan und Tagesausnahmen (Feiertage, Events) – alles
              an einem Ort.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Reguläre Wochentage
              </h3>
              <p className="text-xs text-muted-foreground">
                Standard pro Wochentag. „Geschlossen“ überschreibt Von–Bis.
              </p>
              <WeekdayHoursGrid hours={draft.weeklyHours} onDayChange={updateDay} />
              <OpeningHoursPlatformSyncStatusRow
                badges={
                  <>
                    <OpeningHoursPlatformSyncStatusBadge
                      platformLabel="Google"
                      check={platformHoursStatus?.google.regular}
                      loading={platformHoursStatusLoading}
                      connected={googleConnected}
                      hoursDirty={hoursDirty}
                    />
                    <OpeningHoursPlatformSyncStatusBadge
                      platformLabel="Facebook"
                      check={platformHoursStatus?.facebook.regular}
                      loading={platformHoursStatusLoading}
                      connected={facebookConnected}
                      hoursDirty={hoursDirty}
                    />
                  </>
                }
              >
                <IntegrationPlatformSyncButton
                  target="opening_hours_google"
                  restaurantId={workspaceRestaurantId}
                  connected={googleConnected}
                  connectionsLoading={platformConnectionsLoading}
                  blockedReason={
                    hoursDirty ? "Zuerst Öffnungszeiten speichern" : null
                  }
                  onSynced={bumpPlatformStatus}
                  className="w-full sm:w-auto"
                />
                <IntegrationPlatformSyncButton
                  target="opening_hours_facebook"
                  restaurantId={workspaceRestaurantId}
                  connected={facebookConnected}
                  connectionsLoading={platformConnectionsLoading}
                  blockedReason={
                    hoursDirty ? "Zuerst Öffnungszeiten speichern" : null
                  }
                  onSynced={bumpPlatformStatus}
                  className="w-full sm:w-auto"
                />
              </OpeningHoursPlatformSyncStatusRow>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Küchenzeiten
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Wann die Küche Gerichte zubereitet (kann kürzer sein als die
                    Restaurant-Öffnungszeiten). Übertragung nur an Google — Facebook
                    unterstützt keine separaten Küchenzeiten.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5">
                  <Label
                    htmlFor="kitchen-hours-enabled"
                    className="cursor-pointer text-xs text-muted-foreground"
                  >
                    Eigene Küchenzeiten
                  </Label>
                  <Switch
                    id="kitchen-hours-enabled"
                    checked={draft.kitchenHoursEnabled}
                    onCheckedChange={(v) => {
                      const enabled = v === true;
                      setDraft((prev) => {
                        if (!prev) return prev;
                        if (!enabled) {
                          return { ...prev, kitchenHoursEnabled: false };
                        }
                        const kitchenWeeklyHours = { ...prev.kitchenWeeklyHours };
                        for (const d of WEEKDAY_ORDER) {
                          kitchenWeeklyHours[d] = {
                            ...prev.weeklyHours[d],
                          };
                        }
                        return {
                          ...prev,
                          kitchenHoursEnabled: true,
                          kitchenWeeklyHours,
                        };
                      });
                    }}
                    size="sm"
                  />
                </div>
              </div>
              {draft.kitchenHoursEnabled ? (
                <>
                  <WeekdayHoursGrid
                    hours={draft.kitchenWeeklyHours}
                    onDayChange={updateKitchenDay}
                  />
                  <OpeningHoursPlatformSyncStatusRow
                    badges={
                      <OpeningHoursPlatformSyncStatusBadge
                        platformLabel="Google Küche"
                        check={platformHoursStatus?.google.kitchen}
                        loading={platformHoursStatusLoading}
                        connected={googleConnected}
                        hoursDirty={hoursDirty}
                      />
                    }
                  >
                    <IntegrationPlatformSyncButton
                      target="kitchen_hours_google"
                      restaurantId={workspaceRestaurantId}
                      connected={googleConnected}
                      connectionsLoading={platformConnectionsLoading}
                      blockedReason={
                        hoursDirty
                          ? "Zuerst Öffnungszeiten speichern"
                          : !draft.kitchenHoursEnabled
                            ? "Zuerst eigene Küchenzeiten aktivieren"
                            : null
                      }
                      onSynced={bumpPlatformStatus}
                      className="w-full sm:w-auto"
                    />
                  </OpeningHoursPlatformSyncStatusRow>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Deaktiviert — es gelten nur die Restaurant-Öffnungszeiten (keine
                  separaten Küchenzeiten in Gwada oder bei Google).
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Ausnahmen
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Abweichende Zeiten an bestimmten Tagen. Standardmäßig nur
                    zukünftige / heutige Termine.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5">
                    <Label
                      htmlFor="show-past-exceptions"
                      className="cursor-pointer text-xs text-muted-foreground"
                    >
                      Vergangene anzeigen
                    </Label>
                    <Switch
                      id="show-past-exceptions"
                      checked={showPastExceptions}
                      onCheckedChange={(v) => setShowPastExceptions(v === true)}
                      size="sm"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className={cn(
                      "gap-1.5 rounded-full",
                      settingsAccentSaveButtonClassName,
                    )}
                    onClick={addException}
                  >
                    <Plus className="size-4" />
                    Termin
                  </Button>
                </div>
              </div>

              <OpeningHoursHolidaySuggestions
                restaurantId={workspaceRestaurantId}
                countryLabel={draft.country}
                existingDates={existingExceptionDates}
                onAddException={addHolidayException}
              />

          {draft.dateExceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Ausnahmen – es gelten nur die regulären Zeiten.
            </p>
          ) : (
            <>
              {!showPastExceptions && hiddenPastCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {hiddenPastCount} vergangene{" "}
                  {hiddenPastCount === 1 ? "Termin" : "Termine"} ausgeblendet.
                </p>
              )}
              <div className="space-y-4">
              {exceptionsVisible.map((ex) => (
              <div
                key={ex.id}
                className="space-y-3 rounded-xl border border-border/40 bg-muted/15 p-4"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Datum</Label>
                    <DatePickerField
                      value={ex.date}
                      onChange={(d) => {
                        if (d) updateException(ex.id, { date: d });
                      }}
                      placeholder="Datum wählen"
                      className="max-w-[min(100%,18rem)]"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                    <Checkbox
                      checked={ex.closed}
                      onCheckedChange={(v) =>
                        updateException(ex.id, { closed: v === true })
                      }
                    />
                    Geschlossen
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ms-auto shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Ausnahme entfernen"
                    onClick={() => setExceptionDeleteId(ex.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex min-h-11 flex-wrap items-center gap-2">
                  {!ex.closed && (
                    <>
                      <Input
                        type="time"
                        value={ex.open ?? ""}
                        onChange={(e) =>
                          updateException(ex.id, { open: e.target.value })
                        }
                        className={formScheduleTimeInputClassName}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={ex.close ?? ""}
                        onChange={(e) =>
                          updateException(ex.id, { close: e.target.value })
                        }
                        className={formScheduleTimeInputClassName}
                      />
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Notiz (optional)</Label>
                  <Input
                    value={ex.note ?? ""}
                    onChange={(e) =>
                      updateException(ex.id, { note: e.target.value })
                    }
                    placeholder="z. B. Nur Abholung"
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>
              ))}
              </div>
            </>
          )}

              <Separator />

              <div className="max-w-2xl space-y-1.5">
                <Label
                  htmlFor="opening-hours-embed-footer"
                  className="text-xs text-muted-foreground"
                >
                  Hinweistext unter den Öffnungszeiten
                </Label>
                <Textarea
                  id="opening-hours-embed-footer"
                  value={openingHoursSettings.embedFooterText}
                  onChange={(e) =>
                    setOpeningHoursSettings((prev) => ({
                      ...prev,
                      embedFooterText: e.target.value,
                    }))
                  }
                  placeholder="z. B. Parkplätze, Feiertags-Hinweise, Dresscode …"
                  maxLength={OPENING_HOURS_EMBED_FOOTER_MAX}
                  rows={4}
                  className="min-h-[6rem] resize-y rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  {publicSurfaceScopeHint("embed")} Optional, max.{" "}
                  {OPENING_HOURS_EMBED_FOOTER_MAX} Zeichen. Küche- und
                  Sondertermine-Optionen unter Einbinden ({publicSurfaceEmbedOnlyDescription})
                </p>
              </div>

              <OpeningHoursPlatformSyncStatusRow
                badges={
                  <OpeningHoursPlatformSyncStatusBadge
                    platformLabel="Google Ausnahmen"
                    check={platformHoursStatus?.google.exceptions}
                    loading={platformHoursStatusLoading}
                    connected={googleConnected}
                    hoursDirty={hoursDirty}
                  />
                }
              >
                <IntegrationPlatformSyncButton
                  target="opening_exceptions_google"
                  restaurantId={workspaceRestaurantId}
                  connected={googleConnected}
                  connectionsLoading={platformConnectionsLoading}
                  blockedReason={
                    hoursDirty
                      ? "Zuerst Öffnungszeiten speichern"
                      : !hasFutureExceptions
                        ? "Keine zukünftigen Ausnahmen vorhanden"
                        : null
                  }
                  onSynced={bumpPlatformStatus}
                  className="w-full sm:w-auto"
                />
              </OpeningHoursPlatformSyncStatusRow>
            </div>
          </CardContent>
        </Card>
        {(googleConnected || facebookConnected) ? (
          <div className="rounded-xl border border-border/50 bg-card px-4 py-4 shadow-card sm:px-6">
            <OpeningHoursPlatformSyncToggles
              googleConnected={googleConnected}
              facebookConnected={facebookConnected}
              syncGoogle={openingHoursSettings.syncGoogleOnSave}
              syncFacebook={openingHoursSettings.syncFacebookOnSave}
              onSyncGoogleChange={(checked) =>
                updateOpeningHoursSyncToggle({ syncGoogleOnSave: checked })
              }
              onSyncFacebookChange={(checked) =>
                updateOpeningHoursSyncToggle({ syncFacebookOnSave: checked })
              }
            />
          </div>
        ) : null}
        <SettingsStickySaveBar show={hoursDirty}>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="submit"
              className={cn(
                "h-11 w-full min-w-[12rem] sm:w-auto sm:shrink-0",
                settingsAccentSaveButtonClassName,
              )}
            >
              {savedHoursFlash ? "Gespeichert" : "Öffnungszeiten speichern"}
            </Button>
          </div>
        </SettingsStickySaveBar>
        </form>
      </section>
      )}

      <ConfirmDialog
        open={exceptionDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setExceptionDeleteId(null);
        }}
        title="Termin-Ausnahme wirklich löschen?"
        description={
          pendingExceptionDateLabel ? (
            <>
              Die Ausnahme für den{" "}
              <span className="font-medium text-foreground">
                {pendingExceptionDateLabel}
              </span>{" "}
              wird entfernt.
            </>
          ) : null
        }
        confirmLabel="Ja, löschen"
        onConfirm={async () => {
          if (exceptionDeleteId) removeException(exceptionDeleteId);
        }}
      />
    </div>
  );
}
