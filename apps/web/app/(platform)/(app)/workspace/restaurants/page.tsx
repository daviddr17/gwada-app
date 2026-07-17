"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRestaurantSetupWizard } from "@/components/onboarding/restaurant-setup-wizard-provider";
import { WorkspaceRestaurantCard } from "@/components/workspace/workspace-restaurant-card";
import { WorkspaceRestaurantsSkeleton } from "@/components/workspace/workspace-restaurants-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useMyRestaurants } from "@/lib/hooks/use-my-restaurants";
import {
  modulePrimaryAddButtonClassName,
  modulePrimaryAddButtonFullWidthClassName,
} from "@/lib/ui/module-primary-add-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getWorkspaceRestaurantId,
  invalidateWorkspaceRestaurantCache,
  notifyWorkspaceRestaurantChanged,
} from "@/lib/supabase/workspace-persistence";
import { cn } from "@/lib/utils";

export default function WorkspaceRestaurantsPage() {
  const t = useTranslations("SetupWizard");
  const { openWizard } = useRestaurantSetupWizard();
  const { session, rows, loading, refresh } = useMyRestaurants();
  const showSkeleton = useDeferredSkeleton(loading);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeBusy, setActiveBusy] = useState(false);

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
      refresh();
    } finally {
      setActiveBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Das aktive Restaurant steuert Speisekarte, Bestand und Einstellungen.
          Du kannst jederzeit wechseln oder ein neues Restaurant anlegen.
        </p>
        <Button
          type="button"
          size="lg"
          className={cn(
            "shrink-0 self-start sm:self-auto",
            modulePrimaryAddButtonClassName,
          )}
          onClick={openWizard}
        >
          <Building2 className="size-4" />
          Neues Restaurant anlegen
        </Button>
      </div>

      {loading && !showSkeleton ? (
        <div className="min-h-[12rem]" aria-busy />
      ) : showSkeleton ? (
        <WorkspaceRestaurantsSkeleton />
      ) : rows.length === 0 ? (
        <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 px-5 py-6">
          <p className="text-sm text-muted-foreground">
            Du bist noch keinem Restaurant zugeordnet.
          </p>
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={openWizard}
          >
            <Building2 className="size-4" />
            {t("finish")}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.restaurantId}>
              <WorkspaceRestaurantCard
                row={r}
                isActive={activeId === r.restaurantId}
                activeBusy={activeBusy}
                onSetActive={() => void handleSetActive(r.restaurantId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
