"use client";

import {
  CalendarPlus,
  Mail,
  Plus,
  Star,
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
  assignStaffKind?: "phone" | "email";
  onCreateContact: () => void;
  onReservation: () => void;
  onReviewInvite: () => void;
  onAssignStaff: () => void;
};

export function ContactInboxThreadHeaderMenu({
  canCreateContact,
  canCreateReservation,
  canSendReviewLink,
  canAssignStaff,
  assignStaffKind = "phone",
  onCreateContact,
  onReservation,
  onReviewInvite,
  onAssignStaff,
}: ContactInboxThreadHeaderMenuProps) {
  if (
    !canCreateContact &&
    !canCreateReservation &&
    !canSendReviewLink &&
    !canAssignStaff
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
