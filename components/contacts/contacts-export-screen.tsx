"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  downloadContactsCsv,
  downloadContactsPdf,
} from "@/lib/contacts/export-contacts";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchContactsForRestaurant,
  type ContactListRow,
} from "@/lib/supabase/contacts-db";

export function ContactsExportScreen() {
  const { profile } = useRestaurantProfile();
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [rows, setRows] = useState<ContactListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchContactsForRestaurant(restaurantId);
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows(data);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const restaurantName = profile.name.trim() || undefined;
  const count = rows.length;

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (loading) {
    return (
      <div
        className="min-h-[12rem] rounded-2xl border border-border/50 bg-card/50"
        aria-busy
      />
    );
  }

  return (
    <>
      <Card className="mx-auto max-w-lg border-border/50 shadow-card">
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Alle Kontakte als CSV oder PDF — inkl. E-Mail, Telefon und Adresse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {count > 0 ? (
              <>
                <span className="font-medium text-foreground">{count}</span>{" "}
                Kontakt{count === 1 ? "" : "e"} werden exportiert.
              </>
            ) : (
              "Noch keine Kontakte zum Exportieren."
            )}
          </p>
          <Button
            type="button"
            className="h-12 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={count === 0}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" />
            Exportieren …
          </Button>
        </CardContent>
      </Card>

      <DataExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Kontakte exportieren"
        description={`${count} Kontakt${count === 1 ? "" : "e"}`}
        itemCount={count}
        onCsv={() => {
          try {
            downloadContactsCsv(rows, { restaurantName });
            toast.success("CSV wurde heruntergeladen.");
            setExportOpen(false);
          } catch {
            toast.error("CSV-Export fehlgeschlagen.");
          }
        }}
        onPdf={() => {
          void (async () => {
            try {
              await downloadContactsPdf(rows, { restaurantName });
              toast.success("PDF wurde heruntergeladen.");
              setExportOpen(false);
            } catch {
              toast.error("PDF-Export fehlgeschlagen.");
            }
          })();
        }}
      />
    </>
  );
}
