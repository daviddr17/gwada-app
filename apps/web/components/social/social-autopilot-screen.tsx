"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SocialBrandKitCard } from "@/components/social/social-brand-kit-card";
import {
  SocialAutopilotStyleDrawer,
  type SocialAutopilotVoiceDraft,
} from "@/components/social/social-autopilot-style-drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  defaultSocialBrandKit,
  type SocialBrandKit,
} from "@/lib/social/social-brand-kit";
import {
  autopilotPrimaryButtonClassName,
  autopilotSecondaryButtonClassName,
} from "@/lib/ui/social-autopilot-buttons";

/**
 * Autopilot-Tab = nur Einstellungen (Social-Marke, Stimme).
 * Erstellen läuft über News → Neue News → KI-Post.
 */
export function SocialAutopilotScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [voiceDraft, setVoiceDraft] =
    useState<SocialAutopilotVoiceDraft | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

  const loadKit = useCallback(async () => {
    if (!restaurantId) return;
    const res = await fetch(
      `/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`,
    );
    const data = (await res.json().catch(() => ({}))) as {
      kit?: SocialBrandKit;
    };
    setKit(data.kit ?? defaultSocialBrandKit(restaurantId));
  }, [restaurantId]);

  useEffect(() => {
    if (!ready || !restaurantId) return;
    void loadKit();
  }, [ready, restaurantId, loadKit]);

  const learnVoice = async () => {
    if (!restaurantId) return;
    setVoiceBusy(true);
    try {
      const res = await fetch("/api/social/brand-kit/learn-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        draft?: SocialAutopilotVoiceDraft;
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error === "not_enough_posts"
            ? "Noch zu wenig Social-Posts — später nochmal"
            : "Hat nicht geklappt",
        );
        return;
      }
      if (data.draft) {
        setVoiceDraft(data.draft);
        setStyleOpen(true);
      }
    } finally {
      setVoiceBusy(false);
    }
  };

  const confirmVoiceDraft = async () => {
    if (!restaurantId || !kit || !voiceDraft) return;
    setVoiceBusy(true);
    try {
      const nextKit: SocialBrandKit = {
        ...kit,
        voiceNotes: voiceDraft.voiceNotes,
        goldCaptions:
          voiceDraft.goldCaptions.length > 0
            ? voiceDraft.goldCaptions
            : kit.goldCaptions,
        tone: voiceDraft.tone ?? kit.tone,
      };
      const res = await fetch("/api/social/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, kit: nextKit }),
      });
      if (!res.ok) {
        toast.error("Schreibstil konnte nicht gespeichert werden");
        return;
      }
      setKit(nextKit);
      setVoiceDraft(null);
      toast.success("Schreibstil übernommen");
      void loadKit();
    } finally {
      setVoiceBusy(false);
    }
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-5 pb-4">
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-3 pt-5">
          <div className="space-y-1">
            <p className="text-sm font-medium">Autopilot-Einstellungen</p>
            <p className="text-sm text-muted-foreground">
              Hier legt ihr Ton, Farben und Stimme fest. Neue Posts erstellt ihr
              unter Übersicht → Neue News → KI-Post.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className={autopilotPrimaryButtonClassName}
              render={<Link href={`${APP_ROUTES.news.overview}?compose=ki`} />}
            >
              Zur News → KI-Post
            </Button>
            <Button
              type="button"
              variant="outline"
              className={autopilotSecondaryButtonClassName}
              onClick={() => setStyleOpen(true)}
            >
              Schreibstil kurz erklären
            </Button>
          </div>
        </CardContent>
      </Card>

      <SocialBrandKitCard restaurantId={restaurantId} />

      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-3 pt-5">
          <div className="space-y-1">
            <p className="text-sm font-medium">Aus Social lernen</p>
            <p className="text-sm text-muted-foreground">
              Wir lesen eure letzten Instagram- und Facebook-Texte und schlagen
              Stimme vor. Nichts wird gespeichert, bis ihr „Übernehmen“ tippt.
            </p>
          </div>
          <Button
            type="button"
            className={autopilotPrimaryButtonClassName}
            disabled={voiceBusy || !kit}
            onClick={() => void learnVoice()}
          >
            {voiceBusy ? "Lese eure Posts …" : "Aus Social lernen"}
          </Button>
        </CardContent>
      </Card>

      <SocialAutopilotStyleDrawer
        open={styleOpen}
        onOpenChange={(next) => {
          setStyleOpen(next);
          if (!next) setVoiceDraft(null);
        }}
        kit={kit}
        voiceBusy={voiceBusy}
        voiceDraft={voiceDraft}
        onLearnFromSocial={learnVoice}
        onConfirmVoice={confirmVoiceDraft}
        onDiscardVoice={() => setVoiceDraft(null)}
      />
    </div>
  );
}
