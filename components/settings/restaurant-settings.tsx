"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  WEEKDAY_LABEL_DE,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
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
  for (const d of WEEKDAY_ORDER) {
    weeklyHours[d] = { ...p.weeklyHours[d] };
  }
  return {
    ...p,
    weeklyHours,
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

export function RestaurantSettingsPanel() {
  const { profile, saveProfile, isReady } = useRestaurantProfile();
  const [draft, setDraft] = useState<RestaurantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRestaurantFlash, setSavedRestaurantFlash] = useState(false);
  const [savedHoursFlash, setSavedHoursFlash] = useState(false);
  const [showPastExceptions, setShowPastExceptions] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => {
      setDraft(cloneProfile(profile));
      setError(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [isReady, profile]);

  const handleSaveRestaurant = () => {
    if (!draft) return;
    const normalized = normalizeProfileForSave(draft);
    const msg = validateRestaurantStammdaten(normalized);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    saveProfile({ ...normalized, id: draft.id });
    setSavedRestaurantFlash(true);
    window.setTimeout(() => setSavedRestaurantFlash(false), 2000);
  };

  const handleSaveHours = () => {
    if (!draft) return;
    const normalized = normalizeProfileForSave(draft);
    const msg = validateOpeningHours(normalized);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    saveProfile({ ...normalized, id: draft.id });
    setSavedHoursFlash(true);
    window.setTimeout(() => setSavedHoursFlash(false), 2000);
  };

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

  const addException = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dateExceptions: [...prev.dateExceptions, newException()],
      };
    });
  };

  if (!draft) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Laden…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <section
        id="settings-restaurant"
        className="scroll-mt-[7.25rem] lg:scroll-mt-[5.5rem]"
      >
        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Restaurant</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Stammdaten für das aktuell ausgewählte Restaurant. Später kannst du
              mehrere Standorte verwalten und hier wechseln.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rs-name">Name</Label>
            <Input
              id="rs-name"
              value={draft.name}
              onChange={(e) =>
                setDraft((p) => (p ? { ...p, name: e.target.value } : p))
              }
              placeholder="z. B. Gwada Soul Kitchen"
              className="h-11 rounded-xl"
            />
          </div>
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
            <p className="text-xs text-muted-foreground">
              https:// wird bei Bedarf automatisch ergänzt.
            </p>
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
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 border-t border-border/50 sm:flex-row sm:items-center">
          <Button
            type="button"
            className="h-11 w-full tap-scale sm:w-auto sm:min-w-[14rem]"
            onClick={handleSaveRestaurant}
          >
            {savedRestaurantFlash ? "Gespeichert" : "Restaurantdaten speichern"}
          </Button>
        </CardFooter>
      </Card>
      </section>

      <section
        id="settings-hours"
        className="scroll-mt-[7.25rem] lg:scroll-mt-[5.5rem]"
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
              <div className="space-y-3 pt-1">
          {WEEKDAY_ORDER.map((day) => {
            const h = draft.weeklyHours[day];
            return (
              <div
                key={day}
                className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-[7.5rem] text-sm font-medium">
                  {WEEKDAY_LABEL_DE[day]}
                </span>
                <div className="flex flex-wrap items-center gap-3 sm:flex-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={h.closed}
                      onCheckedChange={(v) =>
                        updateDay(day, { closed: v === true })
                      }
                    />
                    Geschlossen
                  </label>
                  {!h.closed && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        value={h.open ?? ""}
                        onChange={(e) =>
                          updateDay(day, { open: e.target.value })
                        }
                        className="h-10 w-[7.5rem] rounded-lg tabular-nums"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={h.close ?? ""}
                        onChange={(e) =>
                          updateDay(day, { close: e.target.value })
                        }
                        className="h-10 w-[7.5rem] rounded-lg tabular-nums"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
              </div>
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
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={addException}
                  >
                    <Plus className="size-4" />
                    Termin
                  </Button>
                </div>
              </div>

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
                    <Input
                      type="date"
                      value={ex.date}
                      onChange={(e) =>
                        updateException(ex.id, { date: e.target.value })
                      }
                      className="h-10 rounded-lg"
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
                    onClick={() => removeException(ex.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {!ex.closed && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="time"
                      value={ex.open ?? ""}
                      onChange={(e) =>
                        updateException(ex.id, { open: e.target.value })
                      }
                      className="h-10 w-[7.5rem] rounded-lg"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={ex.close ?? ""}
                      onChange={(e) =>
                        updateException(ex.id, { close: e.target.value })
                      }
                      className="h-10 w-[7.5rem] rounded-lg"
                    />
                  </div>
                )}
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
            </div>
          </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 border-t border-border/50 sm:flex-row sm:items-center">
          <Button
            type="button"
            className="h-11 w-full tap-scale sm:w-auto sm:min-w-[14rem]"
            onClick={handleSaveHours}
          >
            {savedHoursFlash ? "Gespeichert" : "Öffnungszeiten speichern"}
          </Button>
        </CardFooter>
        </Card>
      </section>
    </div>
  );
}
