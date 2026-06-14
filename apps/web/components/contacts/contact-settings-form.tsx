"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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

type SettingsSnapshot = {
  autoCreateFromReservations: boolean;
  autoCreateFromMessages: boolean;
};

function ContactSettingsToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/60 p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="max-w-prose text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
    </div>
  );
}

export function ContactSettingsForm() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [autoCreateFromReservations, setAutoCreateFromReservations] =
    useState(true);
  const [autoCreateFromMessages, setAutoCreateFromMessages] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string | null>(null);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        autoCreateFromReservations,
        autoCreateFromMessages,
      } satisfies SettingsSnapshot),
    [autoCreateFromReservations, autoCreateFromMessages],
  );

  const dirty =
    savedRef.current !== null && !loading && snapshot !== savedRef.current;

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
      const next: SettingsSnapshot = {
        autoCreateFromReservations:
          data?.auto_create_from_reservations ?? true,
        autoCreateFromMessages: data?.auto_create_from_messages ?? true,
      };
      setAutoCreateFromReservations(next.autoCreateFromReservations);
      setAutoCreateFromMessages(next.autoCreateFromMessages);
      savedRef.current = JSON.stringify(next);
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId]);

  const save = () => {
    if (!restaurantId) return;
    setSaving(true);
    void (async () => {
      const { error } = await upsertContactSettings({
        restaurantId,
        autoCreateFromReservations,
        autoCreateFromMessages,
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
          <CardContent className="space-y-3 pt-6">
            <ContactSettingsToggleRow
              id="auto-create-contacts-reservations"
              label="Kontakte aus Reservierungen"
              description="Bei neuer oder geänderter Reservierung wird anhand von Telefonnummer oder E-Mail ein bestehender Kontakt verknüpft. Ist keiner vorhanden und diese Option aktiv, wird automatisch ein neuer Kontakt angelegt."
              checked={autoCreateFromReservations}
              disabled={loading}
              onCheckedChange={setAutoCreateFromReservations}
            />
            <ContactSettingsToggleRow
              id="auto-create-contacts-messages"
              label="Kontakte aus Nachrichten"
              description="Bei eingehender WhatsApp-, E-Mail- oder Facebook/Instagram-Nachricht wird ein passender Kontakt gesucht. Ist keiner vorhanden und diese Option aktiv, wird automatisch ein neuer Kontakt angelegt und die Nachricht zugeordnet."
              checked={autoCreateFromMessages}
              disabled={loading}
              onCheckedChange={setAutoCreateFromMessages}
            />
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
