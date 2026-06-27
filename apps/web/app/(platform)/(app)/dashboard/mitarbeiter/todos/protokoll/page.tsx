import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

export default function LegacyMitarbeiterTodosProtokollPage() {
  redirect(CHECKLISTEN_ROUTES.protokoll);
}
