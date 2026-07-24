"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmbedApiInfoCard } from "@/components/embed/embed-api-info-card";
import {
  EmbedDualThemePreviewFrame,
  embedPreviewSectionHint,
} from "@/components/embed/embed-dual-theme-preview";
import { EmbedSnippetCodeBlock } from "@/components/embed/embed-snippet-code-block";
import { EmbedTextThemeSetting } from "@/components/embed/embed-text-theme-setting";
import { buildGalleryEmbedSnippet } from "@/lib/embed/build-embed-snippet";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

export function GalleryEmbedPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { getProfileForRestaurantId, isReady: profileReady } =
    useRestaurantProfile();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const profile = useMemo(() => {
    if (!restaurantId || !profileReady) return null;
    return getProfileForRestaurantId(restaurantId);
  }, [restaurantId, profileReady, getProfileForRestaurantId]);

  const slug = profile?.slug?.trim() ?? "";
  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const snippet = slug ? buildGalleryEmbedSnippet(slug, origin) : null;

  const markCopied = useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4 pb-8">
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-6 p-4">
          <p className="text-sm text-muted-foreground">
            Galerie-Fotowand auf deiner Website einbinden.
          </p>

          <EmbedTextThemeSetting restaurantId={restaurantId} widget="gallery" />

          {snippet ? (
            <>
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Vorschau</h2>
                <p className="text-xs text-muted-foreground">
                  {embedPreviewSectionHint}
                </p>
                <EmbedDualThemePreviewFrame
                  embedUrl={snippet.embedUrl}
                  widget="gallery"
                  title="Galerie Vorschau"
                  minHeight={520}
                />
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-semibold">Code zum Einbinden</h2>
                <EmbedSnippetCodeBlock code={snippet.recommended} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void copyText(snippet.recommended, "Embed-Code");
                    markCopied("recommended");
                  }}
                >
                  {copiedKey === "recommended" ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Code kopieren
                </Button>
                <p className="text-xs text-muted-foreground">
                  Direktlink:{" "}
                  <a
                    href={snippet.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Galerie in neuem Tab
                  </a>
                </p>
              </section>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Profil-Slug fehlt — unter Einstellungen hinterlegen.
            </p>
          )}
        </CardContent>
      </Card>

      {slug ? <EmbedApiInfoCard moduleId="gallery" /> : null}
    </div>
  );
}
