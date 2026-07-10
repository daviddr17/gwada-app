"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { Apple, ArrowLeft, Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useDocumentTitleOverride } from "@/lib/contexts/document-title-override-context";
import { useWorkspaceDatabaseGate } from "@/components/providers/supabase-database-gate";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_SUPABASE_SIGNIN_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { usePublicOAuthAvailability } from "@/lib/hooks/use-public-oauth-availability";
import {
  startOAuthFlow,
  type GwadaOAuthProvider,
} from "@/lib/supabase/oauth";
import {
  useAuthScreenTransition,
} from "@/components/auth/use-auth-screen-transition";
import { AuthScreenBrandLogo } from "@/components/auth/auth-screen-brand-logo";
import { useAuthEnterTransition } from "@/components/auth/use-auth-enter-transition";
import { waitlistErrorMessage } from "@/lib/waitlist/waitlist-errors";
import { GWADA_STAFF_INVITE_SIGNUP_HINT } from "@/lib/auth/public-signup-gate";
import {
  humanizeLoginErrorMessage,
  isLikelyNetworkAuthFailure,
  LOGIN_REAUTH_MESSAGE,
  loginErrorBannerText,
} from "@/lib/auth/login-error-messages";
import { signInWithPasskeyClient } from "@/lib/auth/passkey-auth";
import { usePasskeyLoginAvailability } from "@/lib/hooks/use-passkey-login-availability";

const backNavLinkClass =
  "inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

function authEnterHref(next: string | null | undefined): string {
  const path = safeInternalPath(next);
  return `/auth/enter?next=${encodeURIComponent(path)}`;
}

export function LoginForm() {
  const { setOverride: setDocumentTitleOverride } = useDocumentTitleOverride();
  const { status: dbStatus, ensureReachable } = useWorkspaceDatabaseGate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const {
    screen,
    transitionTo,
    overlay: authScreenOverlay,
    isTransitioning,
  } = useAuthScreenTransition("login");
  const {
    enterApp,
    overlay: authEnterOverlay,
    isEntering,
  } = useAuthEnterTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [regEmail, setRegEmail] = useState("");
  const [regGivenName, setRegGivenName] = useState("");
  const [regFamilyName, setRegFamilyName] = useState("");
  const [regNote, setRegNote] = useState("");
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [regHasPendingInvite, setRegHasPendingInvite] = useState<boolean | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [magicLinkBusy, setMagicLinkBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const { showGoogle, showApple, showOAuthSection } = usePublicOAuthAvailability();
  const { showPasskey } = usePasskeyLoginAvailability();
  const showAlternativeSignIn = showPasskey || showOAuthSection;

  useLayoutEffect(() => {
    setDocumentTitleOverride(screen === "register" ? "Registrieren" : "Login");
    return () => setDocumentTitleOverride(null);
  }, [screen, setDocumentTitleOverride]);

  const loginToastError = (headline: string, detail?: string) => {
    const text = loginErrorBannerText(headline, detail);
    setBannerError(text);
    toast.error(text);
  };

  const clearLoginError = () => setBannerError(null);

  /** Bereits angemeldet: über /auth/enter (gleicher Pfad wie OAuth — Session-Cookies stabil). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sb = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (cancelled || !session) return;
        enterApp(() => {
          window.location.assign(authEnterHref(nextParam));
        });
      } catch {
        /* Session optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nextParam, enterApp]);

  useEffect(() => {
    const reason = searchParams.get("reason");
    const err = searchParams.get("error");
    let message: string | null = null;
    if (reason === "reauth") {
      message = LOGIN_REAUTH_MESSAGE;
    } else if (err?.trim()) {
      message = humanizeLoginErrorMessage(err);
    }
    if (!message) return;
    setBannerError(message);
    toast.error(message);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("reason");
    const qs = params.toString();
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [searchParams, router]);

  useEffect(() => {
    if (screen !== "register") {
      setRegHasPendingInvite(null);
      return;
    }
    const normalized = regEmail.trim().toLowerCase();
    if (!normalized.includes("@")) {
      setRegHasPendingInvite(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/public/staff-invite/has-pending?${new URLSearchParams({
              email: normalized,
            })}`,
            { cache: "no-store" },
          );
          if (!res.ok) {
            setRegHasPendingInvite(null);
            return;
          }
          const data = (await res.json()) as { pending?: boolean };
          setRegHasPendingInvite(Boolean(data.pending));
        } catch {
          setRegHasPendingInvite(null);
        }
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [screen, regEmail]);

  const handleOAuth = async (provider: GwadaOAuthProvider) => {
    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await startOAuthFlow(sb, provider, {
        next: safeInternalPath(nextParam),
      });
      if (error) {
        loginToastError(
          provider === "google"
            ? "Anmeldung mit Google fehlgeschlagen."
            : "Anmeldung mit Apple fehlgeschlagen.",
          humanizeLoginErrorMessage(error.message),
        );
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Anmeldung fehlgeschlagen.", raw);
    } finally {
      setBusy(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setBusy(true);
    try {
      const { error, cancelled } = await signInWithPasskeyClient();
      if (cancelled) return;
      if (error) {
        loginToastError(error.message);
        return;
      }
      clearLoginError();
      enterApp(() => {
        window.location.assign(authEnterHref(searchParams.get("next")));
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Passkey-Anmeldung fehlgeschlagen.", raw);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setBusy(true);
    try {
      if (isSupabaseOnlyMode()) {
        let reach: { ok: boolean; message: string };
        try {
          reach = await ensureReachable();
        } catch {
          loginToastError("Die Datenbank konnte nicht geprüft werden.");
          return;
        }
        if (!reach.ok) {
          loginToastError(
            "Aktuell gibt es Probleme mit der Datenbank. Eine Anmeldung ist zurzeit nicht möglich.",
          );
          return;
        }
      }
      const sb = createSupabaseBrowserClient();
      let signResult: Awaited<
        ReturnType<typeof sb.auth.signInWithPassword>
      >;
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password.trim();
        signResult = await raceWithTimeout(
          sb.auth.signInWithPassword({
            email: normalizedEmail,
            password: normalizedPassword,
          }),
          GWADA_SUPABASE_SIGNIN_TIMEOUT_MS,
          "Anmeldung (Passwort)",
        );
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        if (isLikelyNetworkAuthFailure(raw)) {
          loginToastError(
            "Keine Verbindung zum Anmeldedienst. Bitte Netzwerk prüfen und es später erneut versuchen.",
            raw,
          );
        } else {
          loginToastError("Anmeldung fehlgeschlagen.", raw);
        }
        return;
      }
      const { error } = signResult;
      if (error) {
        loginToastError(humanizeLoginErrorMessage(error.message));
        return;
      }
      clearLoginError();
      enterApp(() => {
        window.location.assign(authEnterHref(searchParams.get("next")));
      });
      return;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Anmeldung fehlgeschlagen.", raw);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }

    if (isSupabaseOnlyMode()) {
      let reach: { ok: boolean; message: string };
      try {
        reach = await ensureReachable();
      } catch {
        loginToastError("Die Datenbank konnte nicht geprüft werden.");
        return;
      }
      if (!reach.ok) {
        loginToastError(
          "Aktuell gibt es Probleme mit der Datenbank. Ein Zurücksetzen ist zurzeit nicht möglich.",
        );
        return;
      }
    }

    setForgotBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        loginToastError(
          typeof data.error === "string"
            ? data.error
            : "Der Link konnte nicht gesendet werden.",
        );
        return;
      }
      toast.success("E-Mail zum Zurücksetzen gesendet.", {
        description:
          "Falls ein Konto mit dieser Adresse existiert, findest du den Link in deinem Postfach.",
      });
      setForgotMode(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Der Link konnte nicht gesendet werden.", raw);
    } finally {
      setForgotBusy(false);
    }
  };

  const handleMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }

    if (isSupabaseOnlyMode()) {
      let reach: { ok: boolean; message: string };
      try {
        reach = await ensureReachable();
      } catch {
        loginToastError("Die Datenbank konnte nicht geprüft werden.");
        return;
      }
      if (!reach.ok) {
        loginToastError(
          "Aktuell gibt es Probleme mit der Datenbank. Ein Anmelde-Link kann zurzeit nicht gesendet werden.",
        );
        return;
      }
    }

    setMagicLinkBusy(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          next: safeInternalPath(nextParam),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        loginToastError(
          typeof data.error === "string"
            ? data.error
            : "Der Anmelde-Link konnte nicht gesendet werden.",
        );
        return;
      }
      toast.success("Anmelde-Link gesendet.", {
        description: "Prüfe dein Postfach und klicke auf den Link in der E-Mail.",
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Der Anmelde-Link konnte nicht gesendet werden.", raw);
    } finally {
      setMagicLinkBusy(false);
    }
  };

  const handleWaitlistSubmit = async () => {
    if (!regGivenName.trim() || !regFamilyName.trim()) {
      toast.error("Bitte Vor- und Nachname eingeben.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }

    setWaitlistBusy(true);
    try {
      const res = await fetch("/api/public/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          given_name: regGivenName.trim(),
          family_name: regFamilyName.trim(),
          email: regEmail.trim(),
          note: regNote.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already_registered?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(
          typeof data.message === "string"
            ? data.message
            : waitlistErrorMessage(data.error),
        );
        return;
      }
      if (data.already_registered) {
        toast.success("Du stehst bereits auf der Warteliste.", {
          description:
            "Wir benachrichtigen dich per E-Mail, sobald Gwada verfügbar ist.",
        });
      } else {
        toast.success("Du bist auf der Warteliste.", {
          description:
            "Wir benachrichtigen dich per E-Mail, sobald Gwada verfügbar ist.",
        });
      }
      transitionTo("login");
      setEmail(regEmail.trim());
      setRegNote("");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      loginToastError("Eintrag auf die Warteliste fehlgeschlagen.", raw);
    } finally {
      setWaitlistBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      {authScreenOverlay}
      {authEnterOverlay}
      <div className="flex w-full max-w-md flex-col gap-2">
        {screen === "login" ? (
          <Link href="/" className={backNavLinkClass}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Zurück zur Startseite
          </Link>
        ) : (
          <button
            type="button"
            className={backNavLinkClass}
            aria-label="Zurück zur Anmeldung"
            disabled={isTransitioning}
            onClick={() => transitionTo("login")}
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Zurück zur Anmeldung
          </button>
        )}
        <AuthScreenBrandLogo href="/" />
        <Card className="w-full border-border/50 shadow-card">
          {screen === "login" ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {forgotMode ? "Passwort vergessen" : "Anmelden"}
                </CardTitle>
                <CardDescription>
                  {forgotMode
                    ? "Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst."
                    : "Melde dich an, um deine Restaurants zu verwalten."}
                </CardDescription>
                {isSupabaseOnlyMode() && dbStatus === "checking" ? (
                  <p className="text-sm text-muted-foreground">
                    Datenbankverbindung wird geprüft…
                  </p>
                ) : null}
                {isSupabaseOnlyMode() && dbStatus === "error" ? (
                  <p className="text-pretty text-sm text-destructive">
                    Die Datenbank ist derzeit nicht erreichbar.
                  </p>
                ) : null}
                {bannerError ? (
                  <p
                    className="text-pretty text-sm text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {bannerError}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-Mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (bannerError) clearLoginError();
                  }}
                  className="h-11 rounded-xl"
                />
              </div>
              {!forgotMode ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <button
                      type="button"
                      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      disabled={busy || isEntering}
                      onClick={() => setForgotMode(true)}
                    >
                      Passwort vergessen?
                    </button>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (bannerError) clearLoginError();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleLogin();
                    }}
                    className="h-11 rounded-xl"
                  />
                </div>
              ) : null}
              {forgotMode ? (
                <>
                  <Button
                    type="button"
                    className="h-11 w-full"
                    disabled={forgotBusy || isEntering}
                    onClick={() => void handleForgotPassword()}
                  >
                    {forgotBusy ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Link wird gesendet…
                      </>
                    ) : (
                      "Link zum Zurücksetzen senden"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full rounded-xl font-normal"
                    disabled={forgotBusy}
                    onClick={() => setForgotMode(false)}
                  >
                    Zurück zur Anmeldung
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className="h-11 w-full"
                    disabled={busy || isEntering}
                    onClick={() => void handleLogin()}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Anmeldung…
                      </>
                    ) : (
                      "Weiter"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-border/80 bg-background font-normal"
                    disabled={busy || magicLinkBusy || isEntering}
                    onClick={() => void handleMagicLink()}
                  >
                    {magicLinkBusy ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Link wird gesendet…
                      </>
                    ) : (
                      "Magic Link per E-Mail"
                    )}
                  </Button>
                </>
              )}

              {showAlternativeSignIn ? (
                <>
                  <div className="relative py-1">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      oder
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {showPasskey ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                        disabled={busy || isEntering}
                        onClick={() => void handlePasskeySignIn()}
                      >
                        <Fingerprint className="size-5 shrink-0" aria-hidden />
                        Mit Passkey anmelden
                      </Button>
                    ) : null}
                    {showGoogle ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                        disabled={busy}
                        onClick={() => void handleOAuth("google")}
                      >
                        <GoogleGlyph />
                        Mit Google anmelden
                      </Button>
                    ) : null}
                    {showApple ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
                        disabled={busy}
                        onClick={() => void handleOAuth("apple")}
                      >
                        <Apple className="size-5 shrink-0" aria-hidden />
                        Mit Apple anmelden
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-border/40 bg-muted/20 px-6 py-4 sm:px-8">
              <p className="text-center text-sm text-muted-foreground">
                Noch kein Konto?
              </p>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-xl"
                disabled={isTransitioning}
                onClick={() => {
                  transitionTo("register");
                  if (!regEmail.trim()) setRegEmail(email.trim());
                }}
              >
                Registrieren
              </Button>
            </CardFooter>
          </>
        ) : regHasPendingInvite ? (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Restaurant-Einladung
              </CardTitle>
              <CardDescription>{GWADA_STAFF_INVITE_SIGNUP_HINT}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Auf der Einladungsseite kannst du dich mit E-Mail und Passwort
                registrieren. Alternativ: zurück zur Anmeldung und Google oder
                Magic Link nutzen — danach den Einladungslink erneut öffnen und
                beitreten.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-xl"
                disabled={isTransitioning}
                onClick={() => transitionTo("login")}
              >
                Zur Anmeldung
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Demnächst verfügbar
              </CardTitle>
              <CardDescription>
                Gwada wird bald öffentlich starten. Trage dich auf die Warteliste
                ein — wir benachrichtigen dich per E-Mail, sobald du ein Konto
                anlegen kannst.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reg-given">Vorname</Label>
                  <Input
                    id="reg-given"
                    autoComplete="given-name"
                    value={regGivenName}
                    onChange={(e) => setRegGivenName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-family">Nachname</Label>
                  <Input
                    id="reg-family"
                    autoComplete="family-name"
                    value={regFamilyName}
                    onChange={(e) => setRegFamilyName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">E-Mail</Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-note">Notiz (optional)</Label>
                <Textarea
                  id="reg-note"
                  value={regNote}
                  onChange={(e) => setRegNote(e.target.value)}
                  rows={3}
                  placeholder="z. B. Restaurantname oder kurze Nachricht …"
                  className="rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={waitlistBusy}
                onClick={() => void handleWaitlistSubmit()}
              >
                {waitlistBusy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Wird eingetragen…
                  </>
                ) : (
                  "Auf Warteliste setzen"
                )}
              </Button>
            </CardContent>
          </>
        )}
      </Card>
      </div>
    </div>
  );
}
