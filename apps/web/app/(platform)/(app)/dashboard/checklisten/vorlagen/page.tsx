import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

/** Legacy-Route — Vorlagen laufen über ToDo-Listen. */
export default function ChecklistenVorlagenPage() {
  redirect(CHECKLISTEN_ROUTES.todos);
}
