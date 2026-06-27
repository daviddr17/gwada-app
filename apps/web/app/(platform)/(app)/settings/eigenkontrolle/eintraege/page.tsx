import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

export default function LegacySettingsComplianceRecordsPage() {
  redirect(CHECKLISTEN_ROUTES.protokoll);
}
