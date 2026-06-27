import { redirect } from "next/navigation";
import { SUPERADMIN_VORLAGEN_ROUTES } from "@/lib/navigation/superadmin-vorlagen-routes";

export default function SuperadminVorlagenIndexPage() {
  redirect(SUPERADMIN_VORLAGEN_ROUTES.vertragsvorlagen);
}
