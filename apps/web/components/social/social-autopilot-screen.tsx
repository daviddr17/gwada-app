"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SocialBrandKitCard } from "@/components/social/social-brand-kit-card";
import type { SocialAutopilotVoiceDraft } from "@/lib/social/social-autopilot-voice-draft";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

/**
 * Autopilot-Tab = nur Einstellungen (Schreibstil, Aussehen, Kanäle, Live-Vorschau).
 * Erstellen: News → Neue News → KI-Post.
 */
export function SocialAutopilotScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [voiceDraft, setVoiceDraft] =
    useState<SocialAutopilotVoiceDraft | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);

  const learnVoice = useCallback(async () => {
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
      }
    } finally {
      setVoiceBusy(false);
    }
  }, [restaurantId]);

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <SocialBrandKitCard
      restaurantId={restaurantId}
      voiceDraft={voiceDraft}
      voiceBusy={voiceBusy}
      onLearnFromSocial={learnVoice}
      onClearVoiceDraft={() => setVoiceDraft(null)}
    />
  );
}
