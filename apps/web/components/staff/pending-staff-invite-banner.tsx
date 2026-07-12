"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { PendingStaffInviteSheet } from "@/components/staff/pending-staff-invite-sheet";
import {
  type IncompleteStaffMembershipRow,
  type PendingStaffInviteRow,
  usePendingStaffInvites,
} from "@/lib/hooks/use-pending-staff-invites";
import { cn } from "@/lib/utils";

function formatInviteLabel(
  invite: PendingStaffInviteRow | IncompleteStaffMembershipRow,
): string {
  return invite.restaurant_name?.trim() || "Restaurant";
}

function formatInviteDetail(
  invite: PendingStaffInviteRow | IncompleteStaffMembershipRow,
): string {
  const position = invite.position_name?.trim();
  return position ? `Rolle: ${position}` : "Team-Einladung";
}

export function PendingStaffInviteBanner({ className }: { className?: string }) {
  const router = useRouter();
  const { pendingInvites, incompleteMemberships, loading } =
    usePendingStaffInvites();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeInvite, setActiveInvite] = useState<PendingStaffInviteRow | null>(
    null,
  );
  const [activeIncomplete, setActiveIncomplete] =
    useState<IncompleteStaffMembershipRow | null>(null);

  const primaryItem = useMemo(() => {
    if (pendingInvites.length > 0) {
      return {
        kind: "pending" as const,
        invite: pendingInvites[0],
        extraCount:
          pendingInvites.length +
          incompleteMemberships.length -
          1,
      };
    }
    if (incompleteMemberships.length > 0) {
      return {
        kind: "incomplete" as const,
        membership: incompleteMemberships[0],
        extraCount: incompleteMemberships.length - 1,
      };
    }
    return null;
  }, [pendingInvites, incompleteMemberships]);

  if (loading || !primaryItem) {
    return null;
  }

  const openPending = (invite: PendingStaffInviteRow) => {
    setActiveIncomplete(null);
    setActiveInvite(invite);
    setSheetOpen(true);
  };

  const openIncomplete = (membership: IncompleteStaffMembershipRow) => {
    setActiveInvite(null);
    setActiveIncomplete(membership);
    setSheetOpen(true);
  };

  const title =
    primaryItem.kind === "pending"
      ? "Offene Restaurant-Einladung"
      : "Team-Zugang vervollständigen";

  const subtitle =
    primaryItem.kind === "pending"
      ? `${formatInviteLabel(primaryItem.invite)} · ${formatInviteDetail(primaryItem.invite)}`
      : `${formatInviteLabel(primaryItem.membership)} · Zugang aktivieren`;

  const handleDeclined = () => {
    setSheetOpen(false);
    setActiveInvite(null);
    setActiveIncomplete(null);
    toast.success("Einladung abgelehnt.");
    router.refresh();
  };

  const handleAccepted = () => {
    setSheetOpen(false);
    setActiveInvite(null);
    setActiveIncomplete(null);
    toast.success("Du bist jetzt im Team — willkommen!");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() =>
          primaryItem.kind === "pending"
            ? openPending(primaryItem.invite)
            : openIncomplete(primaryItem.membership)
        }
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent/8 px-4 py-3 text-left shadow-card transition-colors hover:bg-accent/12",
          className,
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Mail className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            {title}
            {primaryItem.extraCount > 0
              ? ` (+${primaryItem.extraCount} weitere)`
              : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </button>

      <PendingStaffInviteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        invite={activeInvite}
        incompleteMembership={activeIncomplete}
        onCompleted={handleAccepted}
        onDeclined={handleDeclined}
      />
    </>
  );
}
