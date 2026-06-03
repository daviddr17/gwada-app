"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { fetchReservationSettings } from "@/lib/supabase/reservation-settings-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ReviewRequestSettingsCard() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [gwada, setGwada] = useState(true);
  const [google, setGoogle] = useState(false);
  const [facebook, setFacebook] = useState(false);
  const [googleUrl, setGoogleUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await fetchReservationSettings(restaurantId);
    const row = data as Record<string, unknown> | null;
    setEnabled(Boolean(row?.review_request_enabled));
    setGwada(row?.review_request_include_gwada !== false);
    setGoogle(Boolean(row?.review_request_include_google));
    setFacebook(Boolean(row?.review_request_include_facebook));
    setGoogleUrl(
      typeof row?.review_google_url === "string" ? row.review_google_url : "",
    );
    setFacebookUrl(
      typeof row?.review_facebook_url === "string" ? row.review_facebook_url : "",
    );
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const save = async () => {
    if (!restaurantId) return;
    setBusy(true);
    const sb = createSupabaseBrowserClient();
    const { error } = await sb
      .from("restaurant_reservation_settings")
      .upsert(
        {
          restaurant_id: restaurantId,
          review_request_enabled: enabled,
          review_request_include_gwada: gwada,
          review_request_include_google: google,
          review_request_include_facebook: facebook,
          review_google_url: googleUrl.trim() || null,
          review_facebook_url: facebookUrl.trim() || null,
        },
        { onConflict: "restaurant_id" },
      );
    setBusy(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Bewertungsnachfragen gespeichert.");
  };

  if (!restaurantId || loading) return null;

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Bewertungsnachfragen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="review-enabled">Nach dem Besuch anfragen</Label>
            <p className="text-sm text-muted-foreground">
              Wird an die Danke-Nachricht (E-Mail / WhatsApp) angehängt.
            </p>
          </div>
          <Switch
            id="review-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled ? (
          <>
            <p className="text-sm font-medium">Plattformen in der Nachricht</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="review-gwada">Gwada (Einladungslink)</Label>
                <Switch id="review-gwada" checked={gwada} onCheckedChange={setGwada} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="review-google">Google</Label>
                <Switch id="review-google" checked={google} onCheckedChange={setGoogle} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="review-facebook">Facebook</Label>
                <Switch
                  id="review-facebook"
                  checked={facebook}
                  onCheckedChange={setFacebook}
                />
              </div>
            </div>
            {google ? (
              <div className="space-y-2">
                <Label htmlFor="review-google-url">Google-Bewertungs-URL (optional)</Label>
                <Input
                  id="review-google-url"
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  placeholder="https://g.page/…/review"
                  className="h-10 rounded-xl"
                />
              </div>
            ) : null}
            {facebook ? (
              <div className="space-y-2">
                <Label htmlFor="review-fb-url">Facebook-URL (optional)</Label>
                <Input
                  id="review-fb-url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://www.facebook.com/…/reviews"
                  className="h-10 rounded-xl"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <Button
          type="button"
          className={settingsAccentSaveButtonClassName}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Speichern…" : "Speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
