"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProfilePersoenlicheDatenSkeleton } from "@/components/profile/profile-persoenliche-daten-skeleton";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { cn } from "@/lib/utils";

type ProfileBaseline = {
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

function snapshotFromHook(p: {
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}): ProfileBaseline {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate,
    street: p.street,
    postalCode: p.postalCode,
    city: p.city,
    country: p.country,
  };
}

export default function ProfilePersoenlicheDatenPage() {
  const {
    email,
    firstName,
    lastName,
    birthDate,
    street,
    postalCode,
    city,
    country,
    setFirstName,
    setLastName,
    setBirthDate,
    setStreet,
    setPostalCode,
    setCity,
    setCountry,
    save,
    isHydrated,
  } = usePersonalProfileNames();

  const [savedFlash, setSavedFlash] = useState(false);
  /** Bumps after baseline updates so `profileDirty` useMemo recalculates (refs do not rerender). */
  const [baselineTick, setBaselineTick] = useState(0);
  const baselineRef = useRef<ProfileBaseline | null>(null);

  useEffect(() => {
    if (!isHydrated || baselineRef.current) return;
    baselineRef.current = snapshotFromHook({
      firstName,
      lastName,
      birthDate,
      street,
      postalCode,
      city,
      country,
    });
  }, [
    isHydrated,
    firstName,
    lastName,
    birthDate,
    street,
    postalCode,
    city,
    country,
  ]);

  const profileDirty = useMemo(() => {
    if (!isHydrated || !baselineRef.current) return false;
    const cur = snapshotFromHook({
      firstName,
      lastName,
      birthDate,
      street,
      postalCode,
      city,
      country,
    });
    return JSON.stringify(cur) !== JSON.stringify(baselineRef.current);
  }, [
    baselineTick,
    isHydrated,
    firstName,
    lastName,
    birthDate,
    street,
    postalCode,
    city,
    country,
  ]);

  const handleSave = useCallback(async () => {
    const ok = await save();
    if (!ok) return;
    baselineRef.current = snapshotFromHook({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate.trim(),
      street: street.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      country: (country.trim() || "DE"),
    });
    setBaselineTick((t) => t + 1);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }, [
    save,
    firstName,
    lastName,
    birthDate,
    street,
    postalCode,
    city,
    country,
  ]);

  const profileLoading = !isHydrated;
  const showProfileSkeleton = useDeferredSkeleton(profileLoading);

  if (profileLoading) {
    if (showProfileSkeleton) {
      return <ProfilePersoenlicheDatenSkeleton />;
    }
    return (
      <div
        className="min-h-[28rem] w-full"
        aria-busy="true"
        aria-label="Profildaten werden geladen"
      />
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          if (profileDirty) void handleSave();
        }}
      >
        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Persönliche Daten</CardTitle>
            <CardDescription>
              E-Mail stammt aus deinem Konto und kann hier nicht geändert werden.
              Vorname, Nachname, Geburtstag und Adresse werden in deinem
              Benutzerprofil gespeichert und u.a. im Bestellprotokoll unter
              „Bestand“ verwendet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-email">E-Mail</Label>
              <Input
                id="profile-email"
                type="email"
                readOnly
                autoComplete="email"
                value={email}
                tabIndex={-1}
                className="h-11 cursor-not-allowed rounded-xl bg-muted/40 text-muted-foreground"
              />
              {!email && isHydrated ? (
                <p className="text-xs text-muted-foreground">
                  Nach Anmeldung mit E-Mail erscheint deine Adresse hier.
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-first">Vorname</Label>
                <Input
                  id="profile-first"
                  autoComplete="given-name"
                  disabled={!isHydrated}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last">Nachname</Label>
                <Input
                  id="profile-last"
                  autoComplete="family-name"
                  disabled={!isHydrated}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-birthday">Geburtstag</Label>
              <Input
                id="profile-birthday"
                type="date"
                disabled={!isHydrated}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <Separator />
            <p className="text-sm font-medium">Persönliche Adresse</p>
            <div className="space-y-2">
              <Label htmlFor="profile-street">Straße &amp; Hausnummer</Label>
              <Input
                id="profile-street"
                autoComplete="street-address"
                disabled={!isHydrated}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-zip">PLZ</Label>
                <Input
                  id="profile-zip"
                  autoComplete="postal-code"
                  disabled={!isHydrated}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-city">Ort</Label>
                <Input
                  id="profile-city"
                  autoComplete="address-level2"
                  disabled={!isHydrated}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-country">Land</Label>
              <Input
                id="profile-country"
                autoComplete="country-name"
                disabled={!isHydrated}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="z. B. DE oder Deutschland"
                className="h-11 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <SettingsStickySaveBar show={profileDirty}>
          <Button
            type="submit"
            disabled={!isHydrated}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            {savedFlash ? "Gespeichert" : "Persönliche Daten speichern"}
          </Button>
        </SettingsStickySaveBar>
      </form>
    </div>
  );
}
