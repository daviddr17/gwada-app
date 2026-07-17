"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PersonalProfileHeader } from "@/components/profile/personal-profile-header";
import { ProfileDocumentsSummaryCard } from "@/components/profile/profile-documents-summary-card";
import { ProfileLanguageCard } from "@/components/profile/profile-language-card";
import { ProfilePersoenlicheDatenSkeleton } from "@/components/profile/profile-persoenliche-daten-skeleton";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { type AppLocale, normalizeAppLocale } from "@/i18n/config";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { applyAppLocale } from "@/lib/i18n/apply-app-locale";
import { cn } from "@/lib/utils";

type ProfileBaseline = {
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  locale: AppLocale;
};

function snapshotFromFields(p: ProfileBaseline): string {
  return JSON.stringify(p);
}

export default function ProfilePersoenlicheDatenPage() {
  const t = useTranslations("Profile.personal");
  const tLang = useTranslations("Profile.language");
  const tCommon = useTranslations("Common");
  const activeLocale = normalizeAppLocale(useLocale());
  const router = useRouter();
  const {
    email,
    userId,
    firstName,
    lastName,
    nickname,
    birthDate,
    street,
    postalCode,
    city,
    country,
    avatarStoragePath,
    coverStoragePath,
    setFirstName,
    setLastName,
    setNickname,
    setBirthDate,
    setStreet,
    setPostalCode,
    setCity,
    setCountry,
    patchImagePaths,
    save,
    isHydrated,
    isRemoteLoaded,
  } = usePersonalProfileNames();

  const [draftLocale, setDraftLocale] = useState<AppLocale>(activeLocale);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string | null>(null);

  useEffect(() => {
    setDraftLocale(activeLocale);
  }, [activeLocale]);

  const profileSnapshot = useMemo(
    () =>
      snapshotFromFields({
        firstName,
        lastName,
        nickname,
        birthDate,
        street,
        postalCode,
        city,
        country,
        locale: draftLocale,
      }),
    [
      firstName,
      lastName,
      nickname,
      birthDate,
      street,
      postalCode,
      city,
      country,
      draftLocale,
    ],
  );

  useEffect(() => {
    if (!isHydrated || !isRemoteLoaded) {
      savedRef.current = null;
      return;
    }
    if (savedRef.current === null) {
      savedRef.current = snapshotFromFields({
        firstName,
        lastName,
        nickname,
        birthDate,
        street,
        postalCode,
        city,
        country,
        locale: activeLocale,
      });
      setDraftLocale(activeLocale);
    }
  }, [
    isHydrated,
    isRemoteLoaded,
    firstName,
    lastName,
    nickname,
    birthDate,
    street,
    postalCode,
    city,
    country,
    activeLocale,
  ]);

  const profileDirty =
    savedRef.current !== null && profileSnapshot !== savedRef.current;

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const localeChanged = draftLocale !== activeLocale;
      const ok = await save();
      if (!ok) return;

      if (localeChanged) {
        const localeResult = await applyAppLocale(draftLocale);
        if (!localeResult.ok) {
          toast.error(tLang("updateFailed"));
          return;
        }
      }

      savedRef.current = snapshotFromFields({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim(),
        birthDate: birthDate.trim(),
        street: street.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        country: country.trim() || "DE",
        locale: draftLocale,
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);

      if (localeChanged) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    draftLocale,
    activeLocale,
    save,
    tLang,
    firstName,
    lastName,
    nickname,
    birthDate,
    street,
    postalCode,
    city,
    country,
    router,
  ]);

  // Lokal hydratisierte Daten sofort zeigen (Sidebar hat oft schon warm gemacht).
  // Remote-Fetch blockiert die UI nicht — sonst wirkt der Profil-Tap „tot“.
  const localDraftReady =
    isHydrated &&
    (Boolean(firstName.trim()) ||
      Boolean(lastName.trim()) ||
      Boolean(nickname.trim()) ||
      Boolean(birthDate.trim()) ||
      Boolean(street.trim()) ||
      Boolean(city.trim()) ||
      Boolean(postalCode.trim()));
  const profileLoading = !isHydrated || (!isRemoteLoaded && !localDraftReady);
  const showProfileSkeleton = useDeferredSkeleton(profileLoading);

  if (profileLoading) {
    if (showProfileSkeleton) {
      return <ProfilePersoenlicheDatenSkeleton />;
    }
    return (
      <div
        className="min-h-[28rem] w-full"
        aria-busy="true"
        aria-label={t("loadingAria")}
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
        <PersonalProfileHeader
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          nickname={nickname}
          avatarStoragePath={avatarStoragePath}
          coverStoragePath={coverStoragePath}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onNicknameChange={setNickname}
          onImagePathsChange={patchImagePaths}
          disabled={!isHydrated || saving}
        />

        <ProfileDocumentsSummaryCard />

        <ProfileLanguageCard
          value={draftLocale}
          onChange={setDraftLocale}
          disabled={!isHydrated || saving}
        />

        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t("email")}</Label>
              <Input
                id="profile-email"
                type="email"
                readOnly
                autoComplete="email"
                value={email}
                tabIndex={-1}
                className="h-11 cursor-not-allowed rounded-xl bg-muted/40 text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-birthday">{t("birthday")}</Label>
              <Input
                id="profile-birthday"
                type="date"
                disabled={!isHydrated || saving}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <Separator />
            <p className="text-sm font-medium">{t("addressHeading")}</p>
            <div className="space-y-2">
              <Label htmlFor="profile-street">{t("street")}</Label>
              <Input
                id="profile-street"
                autoComplete="street-address"
                disabled={!isHydrated || saving}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-zip">{t("postalCode")}</Label>
                <Input
                  id="profile-zip"
                  autoComplete="postal-code"
                  disabled={!isHydrated || saving}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-city">{t("city")}</Label>
                <Input
                  id="profile-city"
                  autoComplete="address-level2"
                  disabled={!isHydrated || saving}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-country">{t("country")}</Label>
              <Input
                id="profile-country"
                autoComplete="country-name"
                disabled={!isHydrated || saving}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={t("countryPlaceholder")}
                className="h-11 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <SettingsStickySaveBar show={profileDirty}>
          <Button
            type="submit"
            disabled={!isHydrated || saving}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            {savedFlash ? tCommon("saved") : t("saveProfile")}
          </Button>
        </SettingsStickySaveBar>
      </form>
    </div>
  );
}
