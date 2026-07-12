"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  useRestaurantPendingStaffInvites,
  type RestaurantPendingStaffInviteRow,
} from "@/lib/hooks/use-restaurant-pending-staff-invites";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function staffDisplayName(row: RestaurantPendingStaffInviteRow): string {
  const name = `${row.staff_given_name ?? ""} ${row.staff_family_name ?? ""}`.trim();
  return name || "Mitarbeiter";
}

function contactLabel(row: RestaurantPendingStaffInviteRow): string | null {
  const email = row.staff_email?.trim();
  const phone = row.staff_phone?.trim();
  if (email) return email;
  if (phone) return phone;
  return null;
}

function channelLabel(channel: string): string {
  return channel === "whatsapp" ? "WhatsApp" : "E-Mail";
}

type StaffPendingInvitesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invites: RestaurantPendingStaffInviteRow[];
};

function StaffPendingInvitesSheet({
  open,
  onOpenChange,
  invites,
}: StaffPendingInvitesSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("invitation")}>
        <DrawerHeader>
          <DrawerTitle>Ausstehende Einladungen</DrawerTitle>
          <DrawerDescription>
            {invites.length === 1
              ? "1 Einladung wartet noch auf Antwort."
              : `${invites.length} Einladungen warten noch auf Antwort.`}
          </DrawerDescription>
        </DrawerHeader>

        <ul className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto px-4 pb-2">
          {invites.map((invite) => {
            const contact = contactLabel(invite);
            return (
              <li
                key={invite.invite_id}
                className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-card"
              >
                <p className="font-medium">{staffDisplayName(invite)}</p>
                {contact ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{contact}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  {invite.position_name
                    ? `App-Rolle: ${invite.position_name}`
                    : "App-Rolle: —"}
                  {" · "}
                  {channelLabel(invite.channel)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gültig bis {dateFmt.format(new Date(invite.expires_at))}
                </p>
              </li>
            );
          })}
        </ul>

        <DrawerFooter>
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function StaffPendingInvitesChip({
  restaurantId,
  className,
}: {
  restaurantId: string;
  className?: string;
}) {
  const { invites, loading } = useRestaurantPendingStaffInvites(restaurantId);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading || invites.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(moduleManageChipButtonClassName, className)}
        onClick={() => setSheetOpen(true)}
      >
        <Mail className="size-4" />
        Einladungen
        <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground tabular-nums">
          {invites.length}
        </span>
      </Button>

      <StaffPendingInvitesSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        invites={invites}
      />
    </>
  );
}
