"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewRestaurantDrawer } from "@/components/workspace/new-restaurant-drawer";
import { useMyRestaurants } from "@/lib/hooks/use-my-restaurants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getWorkspaceRestaurantId,
  invalidateWorkspaceRestaurantCache,
  notifyWorkspaceRestaurantChanged,
} from "@/lib/supabase/workspace-persistence";

export default function WorkspaceRestaurantsPage() {
  const { session, rows, loading, refresh } = useMyRestaurants();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeBusy, setActiveBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    void getWorkspaceRestaurantId().then(setActiveId);
  }, [session?.user?.id, loading]);

  const handleSetActive = async (restaurantId: string) => {
    if (!session?.user) return;
    setActiveBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("profiles")
        .update({ active_restaurant_id: restaurantId })
        .eq("id", session.user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      invalidateWorkspaceRestaurantCache();
      notifyWorkspaceRestaurantChanged();
      setActiveId(restaurantId);
      toast.success("Aktives Restaurant gewechselt.");
    } finally {
      setActiveBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Meine Restaurants
          </h1>
          <p className="text-muted-foreground">
            Das aktive Restaurant steuert Speisekarte, Bestand und
            Einstellungen. Du kannst jederzeit wechseln oder ein neues Restaurant
            anlegen.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 gap-2 self-start sm:self-auto"
          onClick={() => setDrawerOpen(true)}
        >
          <Building2 className="size-4" />
          Neues Restaurant anlegen
        </Button>
      </header>

      <NewRestaurantDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCreated={() => {
          refresh();
          void getWorkspaceRestaurantId().then(setActiveId);
        }}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Lade Restaurants…</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Du bist noch keinem Restaurant zugeordnet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => {
            const isActive = activeId === r.restaurantId;
            return (
              <li key={r.restaurantId}>
                <Card className="border-border/50 shadow-card">
                  <CardHeader className="gap-2 pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight">
                        {r.name}
                      </CardTitle>
                      {isActive ? (
                        <Badge variant="secondary" className="shrink-0">
                          Aktiv
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {r.slug}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2 pt-0">
                    <Badge variant="outline" className="font-normal capitalize">
                      {r.role}
                    </Badge>
                    {r.isPublished ? (
                      <Badge className="font-normal">Veröffentlicht</Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Entwurf
                      </Badge>
                    )}
                    {!isActive ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="ml-auto"
                        disabled={activeBusy}
                        onClick={() => void handleSetActive(r.restaurantId)}
                      >
                        Als aktiv setzen
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
