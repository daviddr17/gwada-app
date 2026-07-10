"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Fingerprint, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileAnmeldungSkeleton } from "@/components/profile/profile-anmeldung-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { usePasskeyLoginAvailability } from "@/lib/hooks/use-passkey-login-availability";
import {
  deletePasskeyClient,
  listPasskeysClient,
  registerPasskeyClient,
  renamePasskeyClient,
  type GwadaPasskeyListItem,
} from "@/lib/auth/passkey-auth";
import { cn } from "@/lib/utils";

const passkeyConnectedBadgeClassName = cn(
  "border-transparent bg-accent font-normal text-accent-foreground shadow-none",
);

function formatPasskeyDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d. MMM yyyy", { locale: de });
  } catch {
    return "—";
  }
}

type ProfilePasskeysCardProps = {
  /** Mindestens eine andere Anmeldemethode (E-Mail/OAuth) — dann letzten Passkey löschbar. */
  hasOtherSignInMethods: boolean;
};

export function ProfilePasskeysCard({
  hasOtherSignInMethods,
}: ProfilePasskeysCardProps) {
  const { showPasskey } = usePasskeyLoginAvailability();
  const [passkeys, setPasskeys] = useState<GwadaPasskeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<GwadaPasskeyListItem | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { passkeys: next, error } = await listPasskeysClient();
      if (error) {
        toast.error(error.message);
        setPasskeys([]);
        return;
      }
      setPasskeys(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showPasskey) {
      setLoading(false);
      return;
    }
    void reload();
  }, [showPasskey, reload]);

  if (!showPasskey) return null;

  if (showSkeleton) {
    return <ProfileAnmeldungSkeleton />;
  }

  const handleAdd = async () => {
    setBusy(true);
    try {
      const { passkey, error, cancelled } = await registerPasskeyClient();
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(
        passkey?.friendly_name
          ? `Passkey „${passkey.friendly_name}“ wurde hinzugefügt.`
          : "Passkey wurde hinzugefügt.",
      );
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: GwadaPasskeyListItem) => {
    if (!hasOtherSignInMethods && passkeys.length <= 1) {
      toast.error(
        "Mindestens eine Anmeldemethode muss aktiv bleiben. Lege zuerst Google, Apple oder ein Passwort an.",
      );
      return;
    }
    setBusy(true);
    try {
      const { error } = await deletePasskeyClient(item.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Passkey wurde entfernt.");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await renamePasskeyClient(renameTarget.id, name);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Passkey wurde umbenannt.");
      setRenameTarget(null);
      setRenameValue("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Passkeys</CardTitle>
          <CardDescription>
            Anmeldung per Face ID, Touch ID oder Sicherheitsschlüssel — ohne
            Passwort. Passkeys gelten pro Gerät oder Passwort-Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch kein Passkey hinterlegt.
            </p>
          ) : (
            <ul className="space-y-3">
              {passkeys.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/10 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Fingerprint
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="font-medium text-foreground">
                        {item.friendly_name?.trim() || "Passkey"}
                      </span>
                      <Badge className={passkeyConnectedBadgeClassName}>
                        Aktiv
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Angelegt {formatPasskeyDate(item.created_at)}
                      {item.last_used_at
                        ? ` · Zuletzt genutzt ${formatPasskeyDate(item.last_used_at)}`
                        : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:ms-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl border-border/80"
                      disabled={busy}
                      onClick={() => {
                        setRenameTarget(item);
                        setRenameValue(item.friendly_name?.trim() ?? "");
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Umbenennen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl border-border/80"
                      disabled={
                        busy ||
                        (!hasOtherSignInMethods && passkeys.length <= 1)
                      }
                      onClick={() => void handleDelete(item)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Entfernen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 rounded-xl border-border/80 bg-background font-normal"
            disabled={busy}
            onClick={() => void handleAdd()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Fingerprint className="size-4 shrink-0" aria-hidden />
            )}
            Passkey hinzufügen
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={renameTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passkey umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="passkey-rename">Name</Label>
            <Input
              id="passkey-rename"
              value={renameValue}
              maxLength={120}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="z. B. iPhone, MacBook"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameTarget(null);
                setRenameValue("");
              }}
            >
              Abbrechen
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleRename()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
