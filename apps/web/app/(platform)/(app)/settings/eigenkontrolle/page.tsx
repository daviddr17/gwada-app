import { redirect } from "next/navigation";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

export default function LegacySettingsComplianceOverviewPage() {
  redirect(CHECKLISTEN_ROUTES.root);
}
