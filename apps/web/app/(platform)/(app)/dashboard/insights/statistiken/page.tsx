import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Alte Statistiken-URL → Übersicht (nur eine Insights-Ansicht). */
export default async function InsightsStatistikenRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.platform?.trim()) params.set("platform", sp.platform.trim());
  const qs = params.toString();
  redirect(
    qs
      ? `${APP_ROUTES.insights.overview}?${qs}`
      : APP_ROUTES.insights.overview,
  );
}
