import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export default function PosIndexPage() {
  redirect(APP_ROUTES.pos.overview);
}
