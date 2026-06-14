"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Apple, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { ProfileAnmeldungSkeleton } from "@/components/profile/profile-anmeldung-skeleton";
import { PasswordStrengthBar } from "@/components/auth/password-strength-bar";
import {
  PASSWORD_POLICY_ERROR_MESSAGE,
  passwordMeetsPolicy,
} from "@/lib/auth/password-policy";
import { settingsAccentSaveButtonClassName, SettingsStickySaveBar } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  anyOAuthProviderShownInLogin,
  oauthProviderShownInLogin,
  usePublicOAuthAvailability,
} from "@/lib/hooks/use-public-oauth-availability";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  identityHasProvider,
  startOAuthFlow,
  unlinkOAuthProvider,
  type GwadaOAuthProvider,
} from "@/lib/supabase/oauth";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";
import { cn } from "@/lib/utils";

/** Status-Chip „verbunden“ in Tenant-Akzentfarbe (nicht der umgebende Container). */
const oauthConnectedBadgeClassName = cn(
  "border-transparent bg-accent font-normal text-accent-foreground shadow-none",
);

export default function ProfileAnmeldungPage() {
  return (
    <Suspense fallback={<ProfileAnmeldungSkeleton />}>
      <ProfileAnmeldungContent />
    </Suspense>
  );
}

function ProfileAnmeldungContent() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [appleConnected, setAppleConnected] = useState(false);
  const [identityCount, setIdentityCount] = useState(0);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const { flags: oauthFlags, resolved: oauthFlagsResolved, reload: reloadOauthFlags } =
    usePublicOAuthAvailability();
  const showGoogleOAuth = oauthProviderShownInLogin(oauthFlags, "google");
  const showAppleOAuth = oauthProviderShownInLogin(oauthFlags, "apple");
  const router = useRouter();
  const searchParams = useSearchParams();

  const refreshAuthState = async () => {
    if (!workspacePersistenceConfigured()) {
      setCanChangePassword(false);
      setGoogleConnected(false);
      setAppleConnected(false);
      setIdentityCount(0);
      return;
    }
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const identities = user?.identities ?? [];
    setIdentityCount(identities.length);
    setGoogleConnected(identityHasProvider(identities, "google"));
    setAppleConnected(identityHasProvider(identities, "apple"));
    const hasEmailIdentity = identities.some((i) => i.provider === "email");
    setCanChangePassword(Boolean(user?.email && hasEmailIdentity));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refreshAuthState();
      } finally {
        if (!cancelled) setAuthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const linked = searchParams.get("oauth_linked");
    const oauthError = searchParams.get("oauth_error");
    if (linked === "google") {
      toast.success("Google-Konto wurde verknüpft.");
      void refreshAuthState();
      void reloadOauthFlags();
    } else if (oauthError?.trim()) {
      toast.error("Google-Verknüpfung fehlgeschlagen.", {
        description: oauthError.trim().slice(0, 300),
      });
    }
    if (!linked && !oauthError?.trim()) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("oauth_linked");
    params.delete("oauth_error");
    const qs = params.toString();
    router.replace(qs ? `/profile/anmeldung?${qs}` : "/profile/anmeldung");
  }, [searchParams, router]);

  const authLoading = !authResolved;
  const showAuthSkeleton = useDeferredSkeleton(authLoading);
  const showOAuthProviders = anyOAuthProviderShownInLogin(oauthFlags);
  const passwordDirty =
    canChangePassword &&
    (currentPassword.length > 0 ||
      newPassword.length > 0 ||
      confirmPassword.length > 0);
  const oauthCardDescription =
    showGoogleOAuth && showAppleOAuth
      ? "Google- und Apple-Konto mit deinem Profil verknüpfen oder trennen."
      : showGoogleOAuth
        ? "Google-Konto mit deinem Profil verknüpfen oder trennen."
        : "Apple-Konto mit deinem Profil verknüpfen oder trennen.";

  if (authLoading) {
    if (showAuthSkeleton) {
      return <ProfileAnmeldungSkeleton />;
    }
    return (
      <div
        className="min-h-[24rem] w-full"
        aria-busy="true"
        aria-label="Anmeldedaten werden geladen"
      />
    );
  }

  const handleOAuthLink = async (provider: GwadaOAuthProvider) => {
    if (!workspacePersistenceConfigured()) {
      toast.error("Supabase ist nicht konfiguriert.");
      return;
    }
    setOauthBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await startOAuthFlow(sb, provider, { link: true });
      if (error) {
        toast.error(
          provider === "google"
            ? "Google-Verknüpfung fehlgeschlagen."
            : "Apple-Verknüpfung fehlgeschlagen.",
          { description: error.message },
        );
      }
    } finally {
      setOauthBusy(false);
    }
  };

  const handleOAuthUnlink = async (provider: GwadaOAuthProvider) => {
    if (!workspacePersistenceConfigured()) {
      toast.error("Supabase ist nicht konfiguriert.");
      return;
    }
    if (identityCount <= 1) {
      toast.error(
        "Mindestens eine Anmeldemethode muss bestehen bleiben.",
      );
      return;
    }
    setOauthBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await unlinkOAuthProvider(sb, provider);
      if (error) {
        toast.error(
          provider === "google"
            ? "Google-Trennung fehlgeschlagen."
            : "Apple-Trennung fehlgeschlagen.",
          { description: error.message },
        );
        return;
      }
      toast.success(
        provider === "google"
          ? "Google-Verknüpfung entfernt."
          : "Apple-Verknüpfung entfernt.",
      );
      await refreshAuthState();
    } finally {
      setOauthBusy(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!workspacePersistenceConfigured()) {
      toast.error("Supabase ist nicht konfiguriert.");
      return;
    }
    if (!canChangePassword) {
      toast.error(
        "Passwort-Änderung ist nur bei Anmeldung per E-Mail möglich.",
      );
      return;
    }
    if (!currentPassword) {
      toast.error("Bitte das aktuelle Passwort eingeben.");
      return;
    }
    if (!passwordMeetsPolicy(newPassword)) {
      toast.error(PASSWORD_POLICY_ERROR_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Das neue Passwort muss sich vom aktuellen unterscheiden.");
      return;
    }

    setPwBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const email = user?.email;
      if (!email) {
        toast.error("Keine E-Mail-Adresse in der Session.");
        return;
      }

      const { error: signErr } = await sb.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signErr) {
        toast.error("Aktuelles Passwort ist falsch.");
        return;
      }

      const { error: updErr } = await sb.auth.updateUser({
        password: newPassword,
      });
      if (updErr) {
        toast.error(updErr.message);
        return;
      }

      toast.success("Passwort wurde geändert.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {oauthFlagsResolved && showOAuthProviders ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">OAuth &amp; Konten</CardTitle>
            <CardDescription>{oauthCardDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showGoogleOAuth ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Google
                  </span>
                  {googleConnected ? (
                    <Badge className={oauthConnectedBadgeClassName}>
                      Mit Google verbunden
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Nicht verbunden</Badge>
                  )}
                </div>
                {googleConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-border/80 sm:ms-auto"
                    disabled={oauthBusy || identityCount <= 1}
                    onClick={() => void handleOAuthUnlink("google")}
                  >
                    Verknüpfung lösen
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 gap-2 rounded-xl border-border/80 bg-background font-normal sm:ms-auto"
                    disabled={oauthBusy}
                    onClick={() => void handleOAuthLink("google")}
                  >
                    <GoogleGlyph />
                    Mit Google verknüpfen
                  </Button>
                )}
              </div>
            ) : null}
            {showGoogleOAuth && showAppleOAuth ? <Separator /> : null}
            {showAppleOAuth ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Apple
                  </span>
                  {appleConnected ? (
                    <Badge className={oauthConnectedBadgeClassName}>
                      Mit Apple verbunden
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Nicht verbunden</Badge>
                  )}
                </div>
                {appleConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-border/80 sm:ms-auto"
                    disabled={oauthBusy || identityCount <= 1}
                    onClick={() => void handleOAuthUnlink("apple")}
                  >
                    Verknüpfung lösen
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 gap-2 rounded-xl border-border/80 bg-background font-normal sm:ms-auto"
                    disabled={oauthBusy}
                    onClick={() => void handleOAuthLink("apple")}
                  >
                    <Apple className="size-5 shrink-0" aria-hidden />
                    Mit Apple verknüpfen
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Passwort ändern</CardTitle>
          <CardDescription>
            Nur bei Anmeldung per E-Mail und Passwort. Es wird zuerst das aktuelle
            Passwort geprüft; die beiden neuen Eingaben müssen übereinstimmen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!workspacePersistenceConfigured() ? (
            <p className="text-sm text-muted-foreground">
              Supabase-Umgebungsvariablen fehlen — Passwort ändern ist hier nicht
              verfügbar.
            </p>
          ) : !canChangePassword ? (
            <p className="text-sm text-muted-foreground">
              Für dein Konto ist keine E-Mail-Passwort-Anmeldung hinterlegt
              (z.&nbsp;B. nur OAuth). In dem Fall gibt es kein Passwort zum
              Ändern.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="pw-current">Aktuelles Passwort</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={!canChangePassword}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">Neues Passwort</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!canChangePassword}
              className="h-11 rounded-xl"
            />
            <PasswordStrengthBar password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Neues Passwort wiederholen</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  passwordDirty &&
                  canChangePassword &&
                  !pwBusy
                ) {
                  void handlePasswordChange();
                }
              }}
              disabled={!canChangePassword}
              className="h-11 rounded-xl"
            />
            <PasswordStrengthBar password={confirmPassword} showRequirements={false} />
          </div>
        </CardContent>
      </Card>

      <SettingsStickySaveBar show={passwordDirty}>
        <Button
          type="button"
          className={cn(
            "h-11 w-full min-w-[12rem] sm:w-auto",
            settingsAccentSaveButtonClassName,
          )}
          disabled={!canChangePassword || pwBusy}
          onClick={() => void handlePasswordChange()}
        >
          {pwBusy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Wird geändert…
            </>
          ) : (
            "Passwort aktualisieren"
          )}
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}
