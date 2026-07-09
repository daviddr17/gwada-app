"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { AuthScreenShell } from "@/components/auth/auth-screen-brand-logo";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { usePublicOAuthAvailability } from "@/lib/hooks/use-public-oauth-availability";
import {
  startGooglePlatformOAuth,
  startOAuthFlow,
} from "@/lib/supabase/oauth";
import type { StaffInviteViewerStatus } from "@/lib/types/staff";
import { staffInvitePrimaryButtonClassName } from "@/lib/ui/staff-invite-auth-button";

type InvitePreview = {
  invite_id: string;
  restaurant_id: string;
  staff_id: string;
  restaurant_name: string;
  staff_given_name: string;
  staff_family_name: string;
  staff_email: string | null;
  position_name: string;
};

type InviteLoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      invite: InvitePreview;
      viewerStatus: StaffInviteViewerStatus;
      viewerLoggedIn: boolean;
    }
  | { kind: "error"; code: string };

const INVITE_ERROR_COPY: Record<string, { title: string; description: string }> = {
  invalid: {
    title: "Einladung ungültig",
    description: "Der Link ist unvollständig oder fehlerhaft.",
  },
  not_found: {
    title: "Einladung ungültig",
    description: "Der Link wurde nicht gefunden.",
  },
  revoked: {
    title: "Einladung ersetzt",
    description:
      "Dieser Link wurde durch eine neuere Einladung ersetzt. Bitte den zuletzt gesendeten Link verwenden (z. B. aus der letzten WhatsApp- oder E-Mail-Nachricht).",
  },
  expired: {
    title: "Einladung abgelaufen",
    description:
      "Der Link ist älter als 14 Tage. Bitte im Restaurant eine neue Einladung anfordern.",
  },
  accepted: {
    title: "Einladung bereits angenommen",
    description: "Du kannst dich normal anmelden und das Restaurant im Workspace wählen.",
  },
  server_config: {
    title: "Einladung vorübergehend nicht verfügbar",
    description: "Bitte später erneut versuchen.",
  },
};

const VIEWER_STATUS_COPY: Record<
  Exclude<StaffInviteViewerStatus, "anonymous" | "can_join">,
  { title: string; description: string }
> = {
  already_member: {
    title: "Du bist bereits dabei",
    description:
      "Dein Konto gehört schon zu diesem Restaurant. Du musst die Einladung nicht erneut annehmen.",
  },
  staff_linked_other: {
    title: "Einladung bereits verbunden",
    description:
      "Diese Einladung ist schon mit einem anderen App-Konto verknüpft. Bitte melde dich mit diesem Konto an oder wende dich an dein Restaurant.",
  },
  wrong_account: {
    title: "Anderes Konto angemeldet",
    description:
      "Du bist mit einem anderen Konto angemeldet als für diese Einladung vorgesehen. Bitte abmelden und mit dem richtigen Konto fortfahren.",
  },
};

function normalizeTokenFromParams(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

function InviteCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="w-full border-border/50 shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

export default function StaffInvitePage() {
  const params = useParams();
  const token = useMemo(
    () =>
      typeof params.token === "string"
        ? normalizeTokenFromParams(params.token)
        : "",
    [params.token],
  );
  const router = useRouter();

  const [loadState, setLoadState] = useState<InviteLoadState>({ kind: "loading" });
  const [email, setEmail] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { showGoogle, showApple, showOAuthSection } = usePublicOAuthAvailability();
  const inviteNextPath = `/einladung/${encodeURIComponent(token)}`;

  useEffect(() => {
    if (!token) {
      setLoadState({ kind: "error", code: "invalid" });
      return;
    }
    void (async () => {
      setLoadState({ kind: "loading" });
      const res = await fetch(
        `/api/public/staff-invite?${new URLSearchParams({ token })}`,
      );
      const body = (await res.json().catch(() => ({}))) as {
        invite?: InvitePreview;
        error?: string;
        viewerStatus?: StaffInviteViewerStatus;
        viewerLoggedIn?: boolean;
      };
      if (res.ok && body.invite) {
        setLoadState({
          kind: "ready",
          invite: body.invite,
          viewerStatus: body.viewerStatus ?? "anonymous",
          viewerLoggedIn: Boolean(body.viewerLoggedIn),
        });
        if (body.invite.staff_email) setEmail(body.invite.staff_email);
        setGivenName(body.invite.staff_given_name?.trim() ?? "");
        setFamilyName(body.invite.staff_family_name?.trim() ?? "");
        return;
      }
      setLoadState({
        kind: "error",
        code: body.error ?? "not_found",
      });
    })();
  }, [token]);

  const invite = loadState.kind === "ready" ? loadState.invite : null;
  const viewerStatus =
    loadState.kind === "ready" ? loadState.viewerStatus : "anonymous";

  const viewerLoggedIn =
    loadState.kind === "ready" ? loadState.viewerLoggedIn : false;

  const handleOAuth = async (provider: "google" | "apple") => {
    if (!token) return;
    setBusy(true);
    try {
      if (provider === "google") {
        startGooglePlatformOAuth({ next: inviteNextPath });
        return;
      }
      const sb = createSupabaseBrowserClient();
      const { error } = await startOAuthFlow(sb, provider, {
        next: inviteNextPath,
      });
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptLoggedIn = async () => {
    if (!invite) return;
    setBusy(true);
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user?.id) {
      setBusy(false);
      toast.error("Bitte zuerst anmelden.");
      return;
    }
    const ok = await acceptInvite(user.id, {
      givenName: givenName.trim(),
      familyName: familyName.trim(),
    });
    setBusy(false);
    if (ok) {
      toast.success(`Willkommen bei ${invite.restaurant_name}!`);
      goDashboard();
    }
  };

  const acceptInvite = async (
    userId: string,
    names?: { givenName: string; familyName: string },
  ) => {
    const sb = createSupabaseBrowserClient();
    const gn = names?.givenName.trim() ?? "";
    const fn = names?.familyName.trim() ?? "";
    const { data, error } = await sb.rpc("accept_staff_invite", {
      p_token: token,
      p_profile_id: userId,
      ...(gn && fn
        ? { p_given_name: gn, p_family_name: fn }
        : {}),
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    const result = data as {
      ok?: boolean;
      error?: string;
      already_member?: boolean;
      restaurant_id?: string;
    };
    if (!result?.ok) {
      const messages: Record<string, string> = {
        already_member:
          "Du bist bereits Mitglied dieses Restaurants — ein zweites Konto ist nicht möglich.",
        staff_already_linked:
          "Diese Einladung ist bereits mit einem anderen App-Konto verknüpft.",
        invite_not_found: "Einladung ungültig oder abgelaufen.",
      };
      toast.error(
        messages[result.error ?? ""] ??
          result.error ??
          "Einladung konnte nicht angenommen werden.",
      );
      return false;
    }
    if (result.already_member) {
      toast.info("Du bist bereits bei diesem Restaurant angemeldet.");
    }
    return true;
  };

  const goDashboard = () => {
    router.replace("/dashboard");
    router.refresh();
  };

  const handleSignOutAndLogin = async () => {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const validateNames = () => {
    if (!givenName.trim() || !familyName.trim()) {
      toast.error("Bitte Vor- und Nachname eingeben.");
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!invite) return;
    if (!email.trim() || !password) {
      toast.error("E-Mail und Passwort eingeben.");
      return;
    }
    if (!validateNames()) return;
    if (password !== passwordConfirm) {
      toast.error("Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    const gn = givenName.trim();
    const fn = familyName.trim();
    const res = await fetch("/api/public/staff-invite/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        email: email.trim(),
        password,
        givenName: gn,
        familyName: fn,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      needsConfirmation?: boolean;
      message?: string;
    };
    setBusy(false);
    if (!res.ok || !body.ok) {
      toast.error(
        body.message ??
          "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
      );
      return;
    }
    toast.success(
      "Bestätigungs-E-Mail gesendet — bitte Posteingang prüfen (auch Spam). Danach den Einladungslink erneut öffnen und anmelden.",
      { duration: 10_000 },
    );
  };

  const handleLoginAndAccept = async () => {
    if (!invite) return;
    if (!email.trim() || !password) {
      toast.error("E-Mail und Passwort eingeben.");
      return;
    }
    if (!validateNames()) return;
    setBusy(true);
    const sb = createSupabaseBrowserClient();
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      setBusy(false);
      return;
    }
    const ok = await acceptInvite(userId, {
      givenName: givenName.trim(),
      familyName: familyName.trim(),
    });
    setBusy(false);
    if (ok) {
      toast.success(`Du bist jetzt bei ${invite.restaurant_name} dabei.`);
      goDashboard();
    }
  };

  if (loadState.kind === "loading") {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadState.kind === "error") {
    const copy =
      INVITE_ERROR_COPY[loadState.code] ?? INVITE_ERROR_COPY.not_found;
    return (
      <AuthScreenShell>
        <InviteCard title={copy.title} description={copy.description} />
      </AuthScreenShell>
    );
  }

  if (
    viewerStatus === "already_member" ||
    viewerStatus === "staff_linked_other" ||
    viewerStatus === "wrong_account"
  ) {
    const copy = VIEWER_STATUS_COPY[viewerStatus];
    return (
      <AuthScreenShell>
        <InviteCard title={copy.title} description={copy.description}>
          <Button
            type="button"
            className={staffInvitePrimaryButtonClassName}
            onClick={() => {
              if (viewerStatus === "already_member") {
                goDashboard();
                return;
              }
              if (viewerStatus === "wrong_account") {
                void handleSignOutAndLogin();
                return;
              }
              router.replace("/login");
              router.refresh();
            }}
          >
            {viewerStatus === "already_member"
              ? "Zum Dashboard"
              : viewerStatus === "wrong_account"
                ? "Abmelden & neu anmelden"
                : "Zur Anmeldung"}
          </Button>
        </InviteCard>
      </AuthScreenShell>
    );
  }

  const name = [invite!.staff_given_name, invite!.staff_family_name]
    .filter(Boolean)
    .join(" ");

  return (
    <AuthScreenShell>
      <Card className="w-full border-border/50 shadow-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-balance">
            Einladung — {invite!.restaurant_name}
          </CardTitle>
          <CardDescription className="text-pretty leading-relaxed">
            Hallo{name ? ` ${name}` : ""}, du wurdest als{" "}
            <span className="font-medium text-foreground">
              {invite!.position_name}
            </span>{" "}
            eingeladen. Registriere dich oder melde dich an, um beizutreten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {viewerLoggedIn && viewerStatus === "can_join" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Du bist angemeldet. Nimm die Einladung an, um dem Team beizutreten.
              </p>
              <Button
                type="button"
                className={staffInvitePrimaryButtonClassName}
                disabled={busy}
                onClick={() => void handleAcceptLoggedIn()}
              >
                {busy ? "…" : "Einladung annehmen"}
              </Button>
            </>
          ) : (
            <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-given">Vorname</Label>
              <Input
                id="inv-given"
                autoComplete="given-name"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-family">Nachname</Label>
              <Input
                id="inv-family"
                autoComplete="family-name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-email">E-Mail</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-pw">Passwort</Label>
            <Input
              id="inv-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-pw2">Passwort bestätigen</Label>
            <Input
              id="inv-pw2"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            type="button"
            className={staffInvitePrimaryButtonClassName}
            disabled={busy}
            onClick={() => void handleRegister()}
          >
            {busy ? "…" : "Registrieren & beitreten"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={staffInvitePrimaryButtonClassName}
            disabled={busy}
            onClick={() => void handleLoginAndAccept()}
          >
            Bereits Konto — anmelden & beitreten
          </Button>
          {showOAuthSection ? (
            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="text-center text-xs text-muted-foreground">oder</p>
              {showGoogle ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl"
                  disabled={busy}
                  onClick={() => void handleOAuth("google")}
                >
                  <GoogleGlyph />
                  Mit Google registrieren / anmelden
                </Button>
              ) : null}
              {showApple ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl"
                  disabled={busy}
                  onClick={() => void handleOAuth("apple")}
                >
                  Mit Apple registrieren / anmelden
                </Button>
              ) : null}
            </div>
          ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </AuthScreenShell>
  );
}
