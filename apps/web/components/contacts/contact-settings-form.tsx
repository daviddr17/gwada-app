"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  GUEST_CHAT_URL_PLACEHOLDERS,
  validateGuestChatUrlTemplate,
} from "@/lib/contacts/guest-chat-url";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import {
  fetchContactSettings,
  upsertContactSettings,
} from "@/lib/supabase/contact-settings-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

export function ContactSettingsForm() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [autoCreate, setAutoCreate] = useState(true);
  const [guestChatUrl, setGuestChatUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string | null>(null);

  const snapshot = useMemo(
    () => JSON.stringify({ autoCreate, guestChatUrl }),
    [autoCreate, guestChatUrl],
  );

  const dirty =
    savedRef.current !== null &&
    !loading &&
    snapshot !== savedRef.current;

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    savedRef.current = null;
    void (async () => {
      const { data, error } = await fetchContactSettings(restaurantId);
      if (cancel) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const nextAuto = data?.auto_create_from_reservations ?? true;
      const nextUrl = data?.guest_chat_url_template ?? "";
      setAutoCreate(nextAuto);
      setGuestChatUrl(nextUrl);
      savedRef.current = JSON.stringify({
        autoCreate: nextAuto,
        guestChatUrl: nextUrl,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId]);

  const save = () => {
    if (!restaurantId) return;
    const urlErr = validateGuestChatUrlTemplate(guestChatUrl);
    if (urlErr) {
      toast.error(urlErr);
      return;
    }
    setSaving(true);
    void (async () => {
      const { error } = await upsertContactSettings({
        restaurantId,
        autoCreateFromReservations: autoCreate,
        guestChatUrlTemplate: guestChatUrl.trim() || null,
      });
      setSaving(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Einstellungen gespeichert.");
        savedRef.current = snapshot;
      }
    })();
  };

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="pb-4">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Card className="border-border/50 shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/60 p-4">
              <div className="space-y-1">
                <Label htmlFor="auto-create-contacts" className="text-sm font-medium">
                  Kontakte aus Reservierungen
                </Label>
                <p className="text-xs text-muted-foreground max-w-prose">
                  Bei neuer oder geänderter Reservierung wird anhand von Telefonnummer
                  oder E-Mail ein bestehender Kontakt verknüpft. Ist keiner vorhanden
                  und diese Option aktiv, wird automatisch ein neuer Kontakt angelegt.
                </p>
              </div>
              <Switch
                id="auto-create-contacts"
                checked={autoCreate}
                disabled={loading}
                onCheckedChange={(v) => setAutoCreate(v === true)}
              />
            </div>
            <div className="mt-6 space-y-2">
              <Label htmlFor="guest-chat-url">Gast-Chat-Link (Vorlage)</Label>
              <Input
                id="guest-chat-url"
                value={guestChatUrl}
                disabled={loading}
                onChange={(e) => setGuestChatUrl(e.target.value)}
                placeholder="https://…/nachrichten/kontakt?kontakt={kontakt}"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground max-w-prose">
                Platzhalter: {GUEST_CHAT_URL_PLACEHOLDERS.join(", ")} — ohne PIN
                in der URL. Der Zugangscode wird separat versendet (Standard
                48 h gültig). Leer = Standard-Link der App.
              </p>
            </div>
          </CardContent>
        </Card>

        <SettingsStickySaveBar show={dirty}>
          <Button
            type="submit"
            disabled={saving || loading}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            Speichern
          </Button>
        </SettingsStickySaveBar>
      </form>
    </div>
  );
}
