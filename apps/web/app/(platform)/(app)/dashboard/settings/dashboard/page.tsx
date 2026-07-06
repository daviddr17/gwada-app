import { DashboardShortcutsPanel } from "@/components/settings/dashboard-shortcuts-panel";
import { DashboardWidgetsPanel } from "@/components/settings/dashboard-widgets-panel";

export default function SettingsDashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardWidgetsPanel />
      <DashboardShortcutsPanel />
    </div>
  );
}
