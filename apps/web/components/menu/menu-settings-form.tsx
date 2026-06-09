"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { IntegrationPlatformSyncButton } from "@/components/settings/integration-platform-sync-button";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  MENU_CURRENCY_OPTIONS,
  normalizeMenuCurrencyCode,
} from "@/lib/constants/menu-currencies";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import {
  fetchMenuSettings,
  upsertMenuSettings,
} from "@/lib/supabase/menu-settings-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function MenuSettingsForm() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const {
    loading: platformConnectionsLoading,
    googleConnected,
  } = useReviewPlatformConnections(restaurantId);

  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [savedCurrencyCode, setSavedCurrencyCode] = useState("EUR");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!workspaceReady || !restaurantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMenuSettings(restaurantId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error("Einstellungen konnten nicht geladen werden.");
        setLoading(false);
        return;
      }
      const code = normalizeMenuCurrencyCode(data?.currency_code);
      setCurrencyCode(code);
      setSavedCurrencyCode(code);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, workspaceReady]);

  const dirty = currencyCode !== savedCurrencyCode;

  const previewPrice = useMemo(
    () => formatMenuPrice(12.5, currencyCode),
    [currencyCode],
  );

  const save = async () => {
    if (!restaurantId || !dirty) return;
    setPending(true);
    const { error } = await upsertMenuSettings({
      restaurantId,
      currencyCode,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedCurrencyCode(currencyCode);
    toast.success("Speisekarten-Einstellungen gespeichert.");
  };

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-0 pb-4">
      <form
        ref={formRef}
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-6 pt-6">
            <div className="max-w-xl space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Währung
                </h3>
                <p className="text-sm text-muted-foreground">
                  Preise in der Speisekarte, im Filter und bei der Google-Übertragung.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-currency">Anzeige-Währung</Label>
                <SearchableSelect
                  id="menu-currency"
                  options={[...MENU_CURRENCY_OPTIONS]}
                  value={currencyCode}
                  onValueChange={setCurrencyCode}
                  placeholder="Währung wählen"
                  searchPlaceholder="Währung suchen…"
                  disabled={loading || pending}
                  aria-label="Währung für die Speisekarte"
                  className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Beispiel: {previewPrice}
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Integrationen
                </h3>
                <p className="text-sm text-muted-foreground">
                  Verknüpfte Plattformen unter Einstellungen → Integrationen.
                  Weitere Speisekarten-Optionen folgen hier später.
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <IntegrationPlatformSyncButton
                  target="menu_google"
                  restaurantId={restaurantId}
                  connected={googleConnected}
                  connectionsLoading={platformConnectionsLoading}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <SettingsStickySaveBar show={dirty}>
          <Button
            type="submit"
            disabled={pending || loading || !dirty}
            className={cn(settingsAccentSaveButtonClassName, "min-w-[8rem]")}
          >
            {pending ? "Speichern …" : "Speichern"}
          </Button>
        </SettingsStickySaveBar>
      </form>
    </div>
  );
}
