import { SettingsIntegrationenClient } from "./settings-integrationen-client";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsIntegrationenPage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const platformFlags = await fetchPlatformMessagingFlags(sb);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Integrationen</h2>
        <p className="text-sm text-muted-foreground">
          Verbinde Kanäle wie WhatsApp, E-Mail und Social Media mit eurem
          Restaurant — für Nachrichten, Bewertungen, Beiträge und weitere
          Funktionen in Gwada.
        </p>
      </div>
      <SettingsIntegrationenClient initialPlatformFlags={platformFlags} />
    </div>
  );
}
