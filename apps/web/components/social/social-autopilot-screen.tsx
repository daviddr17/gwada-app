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
 * Autopilot-Tab = nur Einstellungen (Schreibstil, Aussehen, Kanäle).
 * Erstellen: News → Neue News → KI-Post.
 */
export function SocialAutopilotScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [voiceDraft, setVoiceDraft] =
    useState<SocialAutopilotVoiceDraft | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [kitEpoch, setKitEpoch] = useState(0);

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
      setKitEpoch((n) => n + 1);
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
            <p className="text-sm font-medium">Aus Social lernen</p>
            <p className="text-sm text-muted-foreground">
              Liest eure letzten Instagram- und Facebook-Texte und schlägt Stimme
              vor. Speichern erst nach „Übernehmen“.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className={autopilotPrimaryButtonClassName}
              disabled={voiceBusy || !kit}
              onClick={() => void learnVoice()}
            >
              {voiceBusy ? "Lese eure Posts …" : "Aus Social lernen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={autopilotSecondaryButtonClassName}
              onClick={() => setStyleOpen(true)}
            >
              Aktuellen Stil ansehen
            </Button>
            <Button
              type="button"
              variant="outline"
              className={autopilotSecondaryButtonClassName}
              render={<Link href={`${APP_ROUTES.news.overview}?compose=ki`} />}
            >
              Zur News → KI-Post
            </Button>
          </div>
        </CardContent>
      </Card>

      <SocialBrandKitCard key={kitEpoch} restaurantId={restaurantId} />

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
