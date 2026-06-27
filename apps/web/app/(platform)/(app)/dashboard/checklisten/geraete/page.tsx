import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

/** Legacy-Route — Geräte werden unter ToDo-Listen verwaltet. */
export default function ChecklistenGeraetePage() {
  redirect(CHECKLISTEN_ROUTES.todos);
}
