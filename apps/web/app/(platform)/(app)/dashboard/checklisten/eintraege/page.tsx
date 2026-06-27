import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

/** Legacy-Route — Nachweise und Änderungen unter Protokoll. */
export default function ChecklistenEintraegePage() {
  redirect(CHECKLISTEN_ROUTES.protokoll);
}
