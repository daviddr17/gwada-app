"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import {
  downloadSuperadminRestaurantsCsv,
  downloadSuperadminRestaurantsPdf,
} from "@/lib/superadmin/export-superadmin-restaurants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchSuperadminRestaurants,
  type SuperadminRestaurantRow,
} from "@/lib/supabase/platform-superadmin-db";

export function SuperadminRestaurantsExportScreen() {
  const branding = usePlatformAppBrandingOptional();
  const [rows, setRows] = useState<SuperadminRestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminRestaurants(sb);
    if (error) {
      toast.error(error);
      setRows([]);
    } else {
      setRows(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const platformName = branding?.appName?.trim() || undefined;
  const count = rows.length;

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
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardDescription>
            Alle Restaurants als CSV oder PDF — inkl. Owner, Kontakt und Status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {count > 0 ? (
              <>
                <span className="font-medium text-foreground">{count}</span>{" "}
                Restaurant{count === 1 ? "" : "s"} werden exportiert.
              </>
            ) : (
              "Noch keine Restaurants zum Exportieren."
            )}
          </p>
          <Button
            type="button"
            className={cn("h-12 w-full gap-2 ", brandActionButtonRoundedClassName)}
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
        title="Restaurants exportieren"
        description={`${count} Restaurant${count === 1 ? "" : "s"}`}
        itemCount={count}
        onCsv={() => {
          try {
            downloadSuperadminRestaurantsCsv(rows, { platformName });
            toast.success("CSV wurde heruntergeladen.");
            setExportOpen(false);
          } catch {
            toast.error("CSV-Export fehlgeschlagen.");
          }
        }}
        onPdf={() => {
          void (async () => {
            try {
              await downloadSuperadminRestaurantsPdf(rows, { platformName });
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
