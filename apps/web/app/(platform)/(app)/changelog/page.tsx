import { permanentRedirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Legacy `/changelog` → Dashboard-SPA (`/dashboard/changelog`). */
export default function ChangelogLegacyRedirectPage() {
  permanentRedirect(APP_ROUTES.changelog);
}
