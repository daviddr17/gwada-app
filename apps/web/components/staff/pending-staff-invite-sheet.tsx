"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptPendingStaffInviteClient,
  repairIncompleteStaffMembershipClient,
  type IncompleteStaffMembershipRow,
  type PendingStaffInviteRow,
  usePendingStaffInvites,
} from "@/lib/hooks/use-pending-staff-invites";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";

const ACCEPT_ERROR_COPY: Record<string, string> = {
  invite_not_found: "Einladung ungültig oder abgelaufen.",
  staff_already_linked: "Diese Einladung ist bereits mit einem anderen Konto verknüpft.",
  forbidden: "Diese Einladung passt nicht zu deinem Konto.",
  already_member: "Du bist bereits Mitglied dieses Restaurants.",
  nothing_to_repair: "Es gibt nichts zu reparieren — bitte Seite neu laden.",
};

type PendingStaffInviteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invite: PendingStaffInviteRow | null;
  incompleteMembership: IncompleteStaffMembershipRow | null;
  onCompleted: () => void;
};

export function PendingStaffInviteSheet({
  open,
  onOpenChange,
  invite,
  incompleteMembership,
  onCompleted,
}: PendingStaffInviteSheetProps) {
  const { refresh } = usePendingStaffInvites();
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [busy, setBusy] = useState(false);

  const mode = invite ? "pending" : incompleteMembership ? "repair" : null;

  useEffect(() => {
    if (!open) return;
    const source = invite ?? incompleteMembership;
    if (!source) return;
    setGivenName(source.staff_given_name?.trim() ?? "");
    setFamilyName(source.staff_family_name?.trim() ?? "");
  }, [open, invite, incompleteMembership]);

  const restaurantName =
    invite?.restaurant_name ?? incompleteMembership?.restaurant_name ?? "";
  const positionName =
    invite?.position_name ?? incompleteMembership?.position_name ?? "";

  const handleAccept = async () => {
    if (!invite) return;
    if (!givenName.trim() || !familyName.trim()) {
      toast.error("Bitte Vor- und Nachname eingeben.");
      return;
    }
    setBusy(true);
    const result = await acceptPendingStaffInviteClient({
      inviteId: invite.invite_id,
      givenName: givenName.trim(),
      familyName: familyName.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(
        ACCEPT_ERROR_COPY[result.error ?? ""] ??
          "Einladung konnte nicht angenommen werden.",
      );
      return;
    }
    await refresh();
    onCompleted();
  };

  const handleRepair = async () => {
    if (!incompleteMembership) return;
    setBusy(true);
    const result = await repairIncompleteStaffMembershipClient({
      staffId: incompleteMembership.staff_id,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(
        ACCEPT_ERROR_COPY[result.error ?? ""] ??
          "Team-Zugang konnte nicht aktiviert werden.",
      );
      return;
    }
    await refresh();
    onCompleted();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName}>
        <DrawerHeader>
          <DrawerTitle>
            {mode === "repair"
              ? `Team-Zugang — ${restaurantName}`
              : `Einladung — ${restaurantName}`}
          </DrawerTitle>
          <DrawerDescription className="text-pretty leading-relaxed">
            {mode === "repair" ? (
              <>
                Dein Konto ist mit diesem Restaurant verknüpft, der Team-Zugang
                fehlt aber noch. Aktiviere ihn hier, um Dashboard und Module zu
                nutzen.
              </>
            ) : (
              <>
                Du wurdest als{" "}
                <span className="font-medium text-foreground">
                  {positionName || "Mitarbeiter"}
                </span>{" "}
                eingeladen. Nimm die Einladung an, um dem Team beizutreten.
              </>
            )}
          </DrawerDescription>
        </DrawerHeader>

        {mode === "pending" ? (
          <div className="space-y-4 px-4 pb-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pending-inv-given">Vorname</Label>
                <Input
                  id="pending-inv-given"
                  autoComplete="given-name"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pending-inv-family">Nachname</Label>
                <Input
                  id="pending-inv-family"
                  autoComplete="family-name"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        ) : null}

        <DrawerFooter>
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            disabled={busy || !mode}
            onClick={() =>
              void (mode === "repair" ? handleRepair() : handleAccept())
            }
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                …
              </>
            ) : mode === "repair" ? (
              "Team-Zugang aktivieren"
            ) : (
              "Einladung annehmen"
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
