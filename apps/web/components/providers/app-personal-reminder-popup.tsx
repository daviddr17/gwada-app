"use client";

import { PersonalReminderPopup } from "@/components/checklisten/personal-reminder-popup";
import { usePersonalReminderPopup } from "@/lib/hooks/use-personal-reminder-popup";

/** App-Zone: Modal zur geplanten Uhrzeit für persönliche Erinnerungen. */
export function AppPersonalReminderPopup() {
  const popup = usePersonalReminderPopup();
  return (
    <PersonalReminderPopup
      open={popup.open}
      note={popup.active}
      busy={popup.busy}
      onAcknowledge={popup.acknowledge}
      onComplete={popup.complete}
      onOpenChange={popup.onOpenChange}
    />
  );
}
