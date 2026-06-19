"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type CreateDefaults = {
  name: string;
  descriptionSuggestion: string;
  hasAvatar: boolean;
};

function createErrorMessage(error: string): string {
  switch (error) {
    case "whatsapp_not_connected":
      return "WhatsApp ist nicht verbunden. Bitte zuerst unter Integrationen verbinden.";
    case "owner_channel_exists":
      return "Es existiert bereits ein OWNER-Kanal — Auswahl in der Liste.";
    case "invalid_channel_name":
      return "Bitte einen gültigen Kanalnamen eingeben (max. 120 Zeichen).";
    case "invalid_channel_description":
      return "Beschreibung ist zu lang (max. 500 Zeichen).";
    case "waha_not_configured":
      return "WAHA ist nicht konfiguriert.";
    default:
      return `Kanal konnte nicht angelegt werden (${error}).`;
  }
}

export function CreateWhatsappNewsChannelDialog(props: {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: {
    channel: { id: string; name: string; invite?: string | null };
    whatsappChannelIds: string[];
  }) => void;
}) {
  const { restaurantId, open, onOpenChange, onCreated } = props;
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [hasAvatar, setHasAvatar] = useState(false);

  const loadDefaults = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingDefaults(true);
    try {
      const res = await fetch(
        `/api/news/whatsapp-channels/create-defaults?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as CreateDefaults & { error?: string };
      if (!res.ok) {
        toast.error(createErrorMessage(data.error ?? "load_failed"));
        onOpenChange(false);
        return;
      }
      setName(data.name ?? "");
      setDescription(data.descriptionSuggestion ?? "");
      setHasAvatar(Boolean(data.hasAvatar));
      setIncludeLogo(Boolean(data.hasAvatar));
    } catch {
      toast.error("Voreinstellungen konnten nicht geladen werden.");
      onOpenChange(false);
    } finally {
      setLoadingDefaults(false);
    }
  }, [restaurantId, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    void loadDefaults();
  }, [open, loadDefaults]);

  const create = async () => {
    if (!restaurantId || !name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/news/whatsapp-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: name.trim(),
          description: description.trim() || null,
          includeLogo: hasAvatar ? includeLogo : false,
        }),
      });
      const data = (await res.json()) as {
        channel?: { id: string; name: string; invite?: string | null };
        whatsappChannelIds?: string[];
        error?: string;
      };
      if (!res.ok || !data.channel?.id) {
        toast.error(createErrorMessage(data.error ?? "create_failed"));
        return;
      }
      onCreated({
        channel: data.channel,
        whatsappChannelIds: data.whatsappChannelIds ?? [data.channel.id],
      });
      onOpenChange(false);
      toast.success("WhatsApp-Kanal angelegt und für News zugeordnet.");
    } catch {
      toast.error("Netzwerkfehler beim Anlegen des Kanals.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>WhatsApp-Kanal anlegen</DialogTitle>
          <DialogDescription>
            Newsletter-Kanal für News im Dashboard. Name und Beschreibung erscheinen
            in WhatsApp; optional das Restaurant-Logo als Kanalbild.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="wa-channel-name">Kanalname</Label>
            <Input
              id="wa-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={loadingDefaults || creating}
              className="h-10 rounded-xl"
              placeholder="z. B. Restaurant News"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa-channel-description">Beschreibung (optional)</Label>
            <Textarea
              id="wa-channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              disabled={loadingDefaults || creating}
              rows={3}
              className="rounded-xl"
              placeholder="Kurzbeschreibung für Abonnenten …"
            />
          </div>

          {hasAvatar ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
              <Checkbox
                checked={includeLogo}
                onCheckedChange={(v) => setIncludeLogo(v === true)}
                disabled={loadingDefaults || creating}
                className="mt-0.5"
              />
              <span className="text-sm leading-snug">
                Restaurant-Logo als Kanalbild verwenden
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  WAHA lädt das Bild von einer signierten URL — ohne Logo werden nur
                  Name und Beschreibung gesetzt.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Kein Restaurant-Logo hinterlegt — unter Einstellungen → Profil kann
              später ein Logo ergänzt werden.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className={cn("rounded-xl", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={loadingDefaults || creating || !name.trim()}
            className={cn("rounded-xl", settingsAccentSaveButtonClassName)}
            onClick={() => void create()}
          >
            {creating ? "Wird angelegt …" : "Kanal anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateWhatsappNewsChannelTrigger(props: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-9 w-full rounded-xl", brandActionButtonRoundedClassName)}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <Plus className="size-4" />
      Kanal anlegen
    </Button>
  );
}
