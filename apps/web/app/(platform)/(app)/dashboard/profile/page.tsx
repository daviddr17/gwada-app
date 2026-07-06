import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export default function ProfileIndexPage() {
  redirect(APP_ROUTES.profile.personal);
}
