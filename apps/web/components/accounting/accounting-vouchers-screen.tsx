"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccountingFilterChips } from "@/components/accounting/accounting-filter-chips";
import { useLexofficeContactIntegration } from "@/lib/hooks/use-lexoffice-contact-integration";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  parseAccountingPlatformFilter,
  type AccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AccountingVouchersScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const lexoffice = useLexofficeContactIntegration(restaurantId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const platformFilter = parseAccountingPlatformFilter(
    searchParams.get("platform"),
  );

  const selectPlatform = (filter: AccountingPlatformFilter) => {
    const next = new URLSearchParams(searchParams.toString());
    if (filter === "all") next.delete("platform");
    else next.set("platform", filter);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4">
      <AccountingFilterChips
        filter={platformFilter}
        onFilterChange={selectPlatform}
        lexofficeConnected={lexoffice.connected}
      />
      <Button
        type="button"
        size="lg"
        className={modulePrimaryAddButtonFullWidthClassName}
        disabled
      >
        <Plus className="size-4" />
        Neuer Beleg
      </Button>
      <Card className="border-border/50 shadow-card">
        <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
          Beleg-Buchungsmaske (Upload, Beträge, Steuerpositionen) und
          Lexware-Abruf werden als nächster Schritt angebunden — Schema und
          Storage-Bucket sind bereits vorbereitet.
        </CardContent>
      </Card>
    </div>
  );
}
