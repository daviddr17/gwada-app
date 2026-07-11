"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function GallerySettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="px-4 pb-8 sm:px-6">
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p>
            Highlights legst du in der Galerie-Übersicht über „Highlight“ neben den runden
            Vorschauen an — nur mit eigenen Gwada-Bildern.
          </p>
          <p>
            Google-Kategorien werden beim Upload als GBP-Medienkategorie übermittelt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
