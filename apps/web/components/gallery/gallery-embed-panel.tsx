"use client";

import { useMemo, useRef } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmbedSnippetCodeBlock } from "@/components/embed/embed-snippet-code-block";
import { EmbedTextThemeSetting } from "@/components/embed/embed-text-theme-setting";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function GalleryEmbedPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { getProfileForRestaurantId, isReady: profileReady } = useRestaurantProfile();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const profile = useMemo(() => {
    if (!restaurantId || !profileReady) return null;
    return getProfileForRestaurantId(restaurantId);
  }, [restaurantId, profileReady, getProfileForRestaurantId]);

  const slug = profile?.slug?.trim() ?? "";

  const embedUrl = useMemo(() => {
    if (!slug) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/embed/gallery/${slug}`;
  }, [slug]);

  const snippet = useMemo(() => {
    if (!embedUrl) return "";
    return `<iframe src="${embedUrl}" title="Galerie" style="width:100%;min-height:640px;border:0;border-radius:1rem;" loading="lazy"></iframe>`;
  }, [embedUrl]);

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-6">
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Galerie-Fotowand auf deiner Website einbinden.
          </p>
          <EmbedTextThemeSetting restaurantId={restaurantId} widget="gallery" />
          {embedUrl ? (
            <>
              <iframe
                ref={iframeRef}
                src={embedUrl}
                title="Galerie Vorschau"
                className="block min-h-[480px] w-full rounded-xl border border-border/50"
                loading="lazy"
              />
              <EmbedSnippetCodeBlock code={snippet} />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(snippet).then(
                    () => toast.success("Snippet kopiert"),
                    () => toast.error("Kopieren fehlgeschlagen"),
                  );
                }}
              >
                <Copy className="size-4" />
                Snippet kopieren
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Profil-Slug fehlt — unter Einstellungen hinterlegen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
