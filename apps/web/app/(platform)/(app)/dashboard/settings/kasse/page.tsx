import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Legacy: Fiskal-/TSE-Einstellungen liegen unter POS → Einstellungen. */
export default function SettingsKassePage() {
  redirect(APP_ROUTES.pos.settings);
}
