"use client";

import { ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function PosOrdersScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }

  return (
    <div className="space-y-4 pt-2">
      <Card className="border-border/50 shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <ShoppingBag
                className="size-6 text-muted-foreground"
                aria-hidden
              />
            </div>
            <p className="text-sm font-medium">Noch keine Bestellungen</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Bestellungen aus der Kasse, vom Tisch und später aus der
              Online-Bestellung erscheinen hier gebündelt.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
