import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

/** Legacy-Route — ToDo-Listen sind in der Übersicht zusammengeführt. */
export default function ChecklistenTodosRedirectPage() {
  redirect(CHECKLISTEN_ROUTES.root);
}
