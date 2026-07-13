import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export default function InsightsPage() {
  redirect(APP_ROUTES.insights.overview);
}
