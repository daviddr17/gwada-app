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
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import {
  downloadSuperadminUsersCsv,
  downloadSuperadminUsersPdf,
} from "@/lib/superadmin/export-superadmin-users";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchSuperadminUsers,
  type SuperadminUserRow,
} from "@/lib/supabase/platform-superadmin-db";

export function SuperadminUsersExportScreen() {
  const branding = usePlatformAppBrandingOptional();
  const [rows, setRows] = useState<SuperadminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminUsers(sb);
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
      <Card className="mx-auto max-w-lg border-border/50 shadow-card">
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Alle User als CSV oder PDF — inkl. Profil, Sprache und Anmeldung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {count > 0 ? (
              <>
                <span className="font-medium text-foreground">{count}</span>{" "}
                User werden exportiert.
              </>
            ) : (
              "Noch keine User zum Exportieren."
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
        title="User exportieren"
        description={`${count} User`}
        itemCount={count}
        onCsv={() => {
          try {
            downloadSuperadminUsersCsv(rows, { platformName });
            toast.success("CSV wurde heruntergeladen.");
            setExportOpen(false);
          } catch {
            toast.error("CSV-Export fehlgeschlagen.");
          }
        }}
        onPdf={() => {
          void (async () => {
            try {
              await downloadSuperadminUsersPdf(rows, { platformName });
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
