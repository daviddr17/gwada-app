"use client";

import {
  CalendarPlus,
  Mail,
  Plus,
  Star,
  Tags,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ContactInboxThreadHeaderMenuProps = {
  canCreateContact: boolean;
  canCreateReservation: boolean;
  canSendReviewLink: boolean;
  canAssignStaff: boolean;
  canManageLabels?: boolean;
  assignStaffKind?: "phone" | "email";
  onCreateContact: () => void;
  onReservation: () => void;
  onReviewInvite: () => void;
  onAssignStaff: () => void;
  onManageLabels?: () => void;
};

export function ContactInboxThreadHeaderMenu({
  canCreateContact,
  canCreateReservation,
  canSendReviewLink,
  canAssignStaff,
  canManageLabels = false,
  assignStaffKind = "phone",
  onCreateContact,
  onReservation,
  onReviewInvite,
  onAssignStaff,
  onManageLabels,
}: ContactInboxThreadHeaderMenuProps) {
  if (
    !canCreateContact &&
    !canCreateReservation &&
    !canSendReviewLink &&
    !canAssignStaff &&
    !canManageLabels
  ) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0 rounded-full"
            aria-label="Aktionen für diesen Chat"
          />
        }
      >
        <Plus className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {canCreateContact ? (
          <DropdownMenuItem onClick={onCreateContact}>
            <UserPlus className="size-4" aria-hidden />
            Kontakt anlegen
          </DropdownMenuItem>
        ) : null}
        {canCreateReservation ? (
          <DropdownMenuItem onClick={onReservation}>
            <CalendarPlus className="size-4" aria-hidden />
            Reservierung anlegen
          </DropdownMenuItem>
        ) : null}
        {canSendReviewLink ? (
          <DropdownMenuItem onClick={onReviewInvite}>
            <Star className="size-4" aria-hidden />
            Bewertungslink verschicken
          </DropdownMenuItem>
        ) : null}
        {canAssignStaff ? (
          <DropdownMenuItem onClick={onAssignStaff}>
            {assignStaffKind === "email" ? (
              <Mail className="size-4" aria-hidden />
            ) : (
              <Users className="size-4" aria-hidden />
            )}
            {assignStaffKind === "email"
              ? "E-Mail Mitarbeiter zuordnen"
              : "Nummer Mitarbeiter zuordnen"}
          </DropdownMenuItem>
        ) : null}
        {canManageLabels && onManageLabels ? (
          <DropdownMenuItem onClick={onManageLabels}>
            <Tags className="size-4" aria-hidden />
            Labels
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
