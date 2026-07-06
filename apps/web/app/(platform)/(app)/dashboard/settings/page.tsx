import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export default function SettingsIndexPage() {
  redirect(APP_ROUTES.settings.restaurant);
}
