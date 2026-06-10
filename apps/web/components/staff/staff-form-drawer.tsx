"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, Link2, Loader2, LogOut, Mail, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import {
  STAFF_POSITION_TAG_NONE,
  StaffPositionTagSelect,
} from "@/components/staff/staff-position-tag-select";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import {
  fetchStaffInviteContactCheckClient,
  sendStaffInviteClient,
  revokeStaffRestaurantAccessClient,
  uploadStaffAvatarClient,
  type StaffInviteAction,
} from "@/lib/staff/staff-client-api";
import { trackDashboardFileUpload } from "@/lib/uploads/dashboard-file-upload";
import type {
  StaffInviteContactConflict,
  StaffInviteContactConflictResult,
} from "@/lib/staff/staff-invite-contact-conflict-types";
import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";
import { formatRestaurantPositionLabel } from "@/lib/restaurant/format-restaurant-position-label";
import { RestaurantPositionSelect } from "@/components/settings/restaurant-position-select";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceActiveRole } from "@/lib/hooks/use-workspace-active-role";
import { isRestaurantOwnerRole } from "@/lib/types/employee-role";
import { formatGuestPhone, parseGuestPhone } from "@/lib/phone/guest-phone";
import {
  fetchRestaurantPositions,
  type RestaurantPositionRow,
} from "@/lib/supabase/restaurant-positions-db";
import {
  buildStaffAuditChanges,
  formatStaffAuditLogActorLabel,
  formatStaffAuditLogActionLabel,
  formatStaffAuditLogSummary,
  insertStaffAuditLogEntry,
} from "@/lib/staff/staff-log";
import {
  fetchStaffLogEntries,
  fetchStaffContracts,
  insertStaff,
  updateStaff,
  type StaffUpsertPayload,
} from "@/lib/supabase/staff-db";
import { findStaffContractForDay } from "@/lib/staff/staff-day-wage";
import {
  formatStaffContractPeriodDe,
} from "@/lib/staff/staff-contract-period";
import { staffContractsPageUrl } from "@/lib/staff/staff-contract-navigation";
import { localDayKey } from "@/lib/staff/shift-schedule-range";
import type { RestaurantStaffRow, StaffPositionTagDefinition, RestaurantStaffLogEntry, RestaurantStaffContractRow } from "@/lib/types/staff";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatStaffContractPaySummary } from "@/lib/staff/staff-contract-pay";
import {
  profileAvatarFallbackPlateClassName,
  profileAvatarHeaderFrameClassName,
  profileAvatarImageClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";

async function persistStaffDisplayPin(
  staffId: string,
  pin: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(
    `/api/staff/${encodeURIComponent(staffId)}/display-pin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    },
  );
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    if (data.error === "pin_duplicate") {
      return { ok: false, message: "PIN bereits vergeben." };
    }
    return {
      ok: false,
      message:
        pin === null
          ? "PIN konnte nicht entfernt werden."
          : "Display-PIN konnte nicht gespeichert werden.",
    };
  }
  return { ok: true };
}

type StaffFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  restaurantId: string;
  staff: RestaurantStaffRow | null;
  activePositionTags: StaffPositionTagDefinition[];
  onSaved: (staffId?: string) => void;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function profileInitials(given: string, family: string): string {
  const a = given.trim().slice(0, 1).toLocaleUpperCase("de-DE");
  const b = family.trim().slice(0, 1).toLocaleUpperCase("de-DE");
  if (a && b) return a + b;
  return a || b || "?";
}

function formatContractPaySummary(c: RestaurantStaffContractRow): string {
  return formatStaffContractPaySummary(c);
}

const STAFF_INVITE_CONTACT_CHECK_MS = 400;

function staffInviteContactConflictHint(
  conflict: StaffInviteContactConflict,
  channel: "email" | "phone",
): string {
  const staffPart = conflict.staffName
    ? ` (Mitarbeiter: ${conflict.staffName})`
    : "";
  if (channel === "email") {
    return `Diese E-Mail ist bereits mit dem App-Account von ${conflict.label} verbunden${staffPart}.`;
  }
  return `Diese Telefonnummer ist bereits mit dem App-Account von ${conflict.label} verbunden${staffPart}.`;
}

function StaffInviteContactConflictNotice({
  conflict,
  channel,
}: {
  conflict: StaffInviteContactConflict;
  channel: "email" | "phone";
}) {
  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
      {staffInviteContactConflictHint(conflict, channel)}
    </p>
  );
}

export function StaffFormDrawer({
  open,
  onOpenChange,
  mode,
  restaurantId,
  staff,
  activePositionTags,
  onSaved,
}: StaffFormDrawerProps) {
  const router = useRouter();
  const countries = COUNTRIES_REFERENCE_FALLBACK;
  const defaultIso = "DE";
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  const [email, setEmail] = useState("");
  const [phoneIso, setPhoneIso] = useState(defaultIso);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [positionTagId, setPositionTagId] = useState(STAFF_POSITION_TAG_NONE);
  const [positionRoleId, setPositionRoleId] = useState("");
  const [displayPin, setDisplayPin] = useState("");
  const [hasDisplayPin, setHasDisplayPin] = useState(false);
  const [clearDisplayPinOnSave, setClearDisplayPinOnSave] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [positions, setPositions] = useState<RestaurantPositionRow[]>([]);
  const [inviteBusy, setInviteBusy] = useState<StaffInviteAction | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [logEntries, setLogEntries] = useState<RestaurantStaffLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [contactConflicts, setContactConflicts] =
    useState<StaffInviteContactConflictResult | null>(null);
  const [inviteConflictConfirmOpen, setInviteConflictConfirmOpen] = useState(false);
  const [pendingInviteAction, setPendingInviteAction] =
    useState<StaffInviteAction | null>(null);
  const [currentContract, setCurrentContract] =
    useState<RestaurantStaffContractRow | null>(null);
  const [contractLoading, setContractLoading] = useState(false);

  const { role: myRole } = useWorkspaceActiveRole();
  const { has } = useRestaurantPermissions();
  const canManageTeam = has("team.manage") || isRestaurantOwnerRole(myRole);

  const channelConnections = useRestaurantChannelConnections(restaurantId);
  const canSendWhatsapp =
    !channelConnections.loading &&
    channelConnections.whatsappEnabled &&
    channelConnections.whatsappConnected;
  const canSendEmail =
    !channelConnections.loading && channelConnections.staffInviteEmailAvailable;

  const whenFmt = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const resetFromStaff = useCallback(() => {
    if (!staff) {
      setGivenName("");
      setFamilyName("");
      setBirthDate("");
      setNationality("");
      setAddressLine1("");
      setPostalCode("");
      setCity("");
      setCountry("DE");
      setEmail("");
      setPhoneIso(defaultIso);
      setPhoneLocal("");
      setPositionTagId(STAFF_POSITION_TAG_NONE);
      setPositionRoleId("");
      setDisplayPin("");
      setHasDisplayPin(false);
      setClearDisplayPinOnSave(false);
      setIsActive(true);
      setAvatarFile(null);
      return;
    }
    setGivenName(staff.given_name);
    setFamilyName(staff.family_name);
    setBirthDate(staff.birth_date ?? "");
    setNationality(staff.nationality ?? "");
    setAddressLine1(staff.address_line1 ?? "");
    setPostalCode(staff.postal_code ?? "");
    setCity(staff.city ?? "");
    setCountry(staff.country ?? "DE");
    setEmail(staff.email ?? "");
    const parsed = parseGuestPhone(staff.phone ?? "", countries, defaultIso);
    setPhoneIso(parsed.iso2);
    setPhoneLocal(parsed.local);
    setPositionTagId(staff.position_tag_id ?? STAFF_POSITION_TAG_NONE);
    setPositionRoleId(staff.restaurant_position_id ?? "");
    setDisplayPin("");
    setHasDisplayPin(false);
    setClearDisplayPinOnSave(false);
    setIsActive(staff.is_active);
    setAvatarFile(null);
  }, [staff, countries]);

  const reloadLog = useCallback(async () => {
    if (!staff || mode !== "edit") {
      setLogEntries([]);
      return;
    }
    setLogLoading(true);
    const { data, error } = await fetchStaffLogEntries(
      restaurantId,
      staff.id,
    );
    setLogLoading(false);
    if (error) setLogEntries([]);
    else setLogEntries(data);
  }, [restaurantId, staff, mode]);

  useEffect(() => {
    if (!open || mode !== "edit" || !staff) return;
    void reloadLog();
  }, [open, staff?.id, mode, reloadLog]);

  useEffect(() => {
    if (!open || mode !== "edit" || !staff?.id || !restaurantId) {
      setCurrentContract(null);
      setContractLoading(false);
      return;
    }
    let cancelled = false;
    setContractLoading(true);
    void fetchStaffContracts(restaurantId, staff.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setCurrentContract(null);
        setContractLoading(false);
        return;
      }
      setCurrentContract(
        findStaffContractForDay(data, staff.id, localDayKey(new Date())),
      );
      setContractLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, staff?.id, restaurantId]);

  useEffect(() => {
    if (!open) return;
    resetFromStaff();
    void (async () => {
      const sb = createSupabaseBrowserClient();
      const { rows } = await fetchRestaurantPositions(sb, restaurantId);
      setPositions(rows.filter((p) => p.slug !== "owner"));
    })();
  }, [open, resetFromStaff, restaurantId]);

  const invitePositions = useMemo(
    () => positions.filter((p) => p.slug !== "owner"),
    [positions],
  );

  const selectedPosition = useMemo(
    () => invitePositions.find((p) => p.id === positionRoleId) ?? null,
    [invitePositions, positionRoleId],
  );

  useEffect(() => {
    if (!open || invitePositions.length === 0) return;
    const valid = invitePositions.some((p) => p.id === positionRoleId);
    if (valid) return;
    const preferred =
      staff?.restaurant_position_id &&
      invitePositions.some((p) => p.id === staff.restaurant_position_id)
        ? staff.restaurant_position_id
        : invitePositions[0].id;
    setPositionRoleId(preferred);
  }, [open, invitePositions, staff?.restaurant_position_id, positionRoleId]);

  useEffect(() => {
    if (!open || mode !== "edit" || !staff) return;
    void (async () => {
      const res = await fetch(
        `/api/staff/${encodeURIComponent(staff.id)}/display-pin`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { has_pin?: boolean };
      setHasDisplayPin(Boolean(data.has_pin));
    })();
  }, [open, mode, staff?.id]);

  const payload = useMemo((): StaffUpsertPayload => {
    const phone = formatGuestPhone(phoneIso, phoneLocal, countries)?.trim() || null;
    return {
      given_name: givenName.trim(),
      family_name: familyName.trim(),
      birth_date: birthDate || null,
      nationality: nationality.trim() || null,
      address_line1: addressLine1.trim() || null,
      postal_code: postalCode.trim() || null,
      city: city.trim() || null,
      country: country.trim() || "DE",
      email: email.trim() || null,
      phone,
      is_active: isActive,
      position_tag_id:
        positionTagId === STAFF_POSITION_TAG_NONE ? null : positionTagId,
      restaurant_position_id: positionRoleId || null,
    };
  }, [
    givenName,
    familyName,
    birthDate,
    nationality,
    addressLine1,
    postalCode,
    city,
    country,
    email,
    phoneIso,
    phoneLocal,
    countries,
    isActive,
    positionTagId,
    positionRoleId,
  ]);

  const displayName = [givenName, familyName].filter(Boolean).join(" ").trim();
  const initials = profileInitials(givenName, familyName);

  const contactCheckPhone = useMemo(
    () => formatGuestPhone(phoneIso, phoneLocal, countries)?.trim() || null,
    [phoneIso, phoneLocal, countries],
  );

  useEffect(() => {
    if (
      !open ||
      mode !== "edit" ||
      !staff ||
      staff.profile_id ||
      !canManageTeam
    ) {
      setContactConflicts(null);
      return;
    }

    if (!email.trim() && !contactCheckPhone) {
      setContactConflicts(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await fetchStaffInviteContactCheckClient({
          restaurantId,
          staffId: staff.id,
          email: email.trim() || null,
          phone: contactCheckPhone,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (error) {
          setContactConflicts(null);
          return;
        }
        setContactConflicts(data ?? null);
      })();
    }, STAFF_INVITE_CONTACT_CHECK_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    open,
    mode,
    staff,
    restaurantId,
    email,
    contactCheckPhone,
    canManageTeam,
  ]);

  const goToStaffContract = useCallback(() => {
    if (!staff) return;
    onOpenChange(false);
    router.push(staffContractsPageUrl(staff.id, currentContract?.id ?? null));
  }, [staff, currentContract?.id, onOpenChange, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!givenName.trim() || !familyName.trim()) {
      toast.error("Vor- und Nachname sind erforderlich.");
      return;
    }
    setPending(true);
    try {
      let savedStaffId: string | undefined;
      if (mode === "create") {
        const ins = await insertStaff(restaurantId, payload);
        if (!ins) {
          toast.error("Mitarbeiter konnte nicht angelegt werden.");
          return;
        }
        savedStaffId = ins.id;
        if (avatarFile) {
          const { error } = await trackDashboardFileUpload(
            () =>
              uploadStaffAvatarClient({
                restaurantId,
                staffId: ins.id,
                file: avatarFile,
              }),
            {
              errorMessage: () => "Profilbild konnte nicht hochgeladen werden.",
            },
          );
          if (error) return;
        }
        const changes = buildStaffAuditChanges(null, payload, activePositionTags);
        await insertStaffAuditLogEntry(
          restaurantId,
          ins.id,
          "created",
          changes,
        );
        toast.success("Mitarbeiter angelegt");
      } else if (staff) {
        const ok = await updateStaff(staff.id, payload);
        if (!ok) {
          toast.error("Speichern fehlgeschlagen.");
          return;
        }
        const changes = buildStaffAuditChanges(staff, payload, activePositionTags);
        await insertStaffAuditLogEntry(
          restaurantId,
          staff.id,
          "updated",
          changes,
        );
        if (avatarFile) {
          const { error } = await trackDashboardFileUpload(
            () =>
              uploadStaffAvatarClient({
                restaurantId,
                staffId: staff.id,
                file: avatarFile,
              }),
            {
              errorMessage: () => "Profilbild konnte nicht hochgeladen werden.",
            },
          );
          if (error) return;
        }

        const pinChange =
          clearDisplayPinOnSave && hasDisplayPin
            ? ("clear" as const)
            : displayPin.length === 4
              ? ("set" as const)
              : null;
        if (pinChange) {
          const pinResult = await persistStaffDisplayPin(
            staff.id,
            pinChange === "clear" ? null : displayPin,
          );
          if (!pinResult.ok) {
            toast.error(pinResult.message);
            return;
          }
          if (pinChange === "clear") {
            setHasDisplayPin(false);
            setClearDisplayPinOnSave(false);
          } else {
            setHasDisplayPin(true);
            setDisplayPin("");
          }
        }

        toast.success("Gespeichert");
      }
      onSaved(savedStaffId);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  const runInvite = async (action: StaffInviteAction) => {
    if (!staff) return;
    if (!positionRoleId) {
      toast.error("Bitte eine Rolle wählen.");
      return;
    }
    if (action === "email" && !email.trim()) {
      toast.error("E-Mail fehlt am Mitarbeiter.");
      return;
    }
    if (
      action === "whatsapp" &&
      !formatGuestPhone(phoneIso, phoneLocal, countries)
    ) {
      toast.error("Telefonnummer fehlt am Mitarbeiter.");
      return;
    }
    setInviteBusy(action);
    const { inviteUrl, sent, error, conflictLabel, conflictStaffName } =
      await sendStaffInviteClient({
        restaurantId,
        staffId: staff.id,
        restaurantPositionId: positionRoleId,
        action,
      });
    setInviteBusy(null);
    if (error) {
      const messages: Record<string, string> = {
        whatsapp_not_connected: "WhatsApp ist nicht verbunden.",
        email_not_configured: "E-Mail-Versand ist nicht eingerichtet.",
        no_email: "E-Mail fehlt am Mitarbeiter.",
        no_phone: "Telefonnummer fehlt am Mitarbeiter.",
        invalid_phone: "Telefonnummer ist ungültig.",
        already_connected:
          "Mitarbeiter ist bereits mit einem App-Account verbunden.",
        contact_already_connected: conflictLabel
          ? `Kontakt bereits mit App-Account von ${conflictLabel} verbunden${
              conflictStaffName ? ` (Mitarbeiter: ${conflictStaffName})` : ""
            }.`
          : "Kontakt ist bereits mit einem App-Account verbunden.",
      };
      toast.error(messages[error] ?? "Einladung fehlgeschlagen.");
      return;
    }
    if (action === "copy" && inviteUrl) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Einladungslink kopiert.");
      } catch {
        toast.success("Einladung erstellt", { description: inviteUrl });
      }
      return;
    }
    if (action === "whatsapp" && sent) {
      toast.success("Einladung per WhatsApp gesendet.");
      void reloadLog();
      return;
    }
    if (action === "email" && sent) {
      toast.success("Einladung per E-Mail gesendet.");
      void reloadLog();
    }
  };

  const handleInvite = (action: StaffInviteAction) => {
    if (
      action === "whatsapp" &&
      contactConflicts?.phoneConflict
    ) {
      setPendingInviteAction(action);
      setInviteConflictConfirmOpen(true);
      return;
    }
    if (action === "email" && contactConflicts?.emailConflict) {
      setPendingInviteAction(action);
      setInviteConflictConfirmOpen(true);
      return;
    }
    void runInvite(action);
  };

  const linkedProfileLabel = staff?.linked_profile
    ? formatLinkedProfileLabel(staff.linked_profile)
    : null;
  const linkedEmployeeActive = staff?.linked_employee?.is_active ?? true;

  const handleRevokeAccess = async () => {
    if (!staff) return;
    setRevokeBusy(true);
    const { profileLabel, error } = await revokeStaffRestaurantAccessClient({
      restaurantId,
      staffId: staff.id,
    });
    setRevokeBusy(false);
    if (error) {
      const messages: Record<string, string> = {
        last_owner: "Der letzte aktive Inhaber kann nicht entfernt werden.",
        cannot_revoke_self: "Eigener Zugang kann hier nicht entzogen werden.",
        already_revoked: "App-Zugang ist bereits entzogen.",
      };
      toast.error(messages[error] ?? "Zugang konnte nicht entzogen werden.");
      return;
    }
    toast.success(
      profileLabel
        ? `App-Zugang für ${profileLabel} entzogen.`
        : "App-Zugang entzogen.",
    );
    setRevokeOpen(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,760px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-5 pt-2 pb-0 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "create" ? "Mitarbeiter anlegen" : "Mitarbeiter bearbeiten"}
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Profil, Stammdaten und optional Einladung zur App.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={cn(staffDrawerScrollClassName, "px-5")}>
            {/* Profil-Kopf (Facebook-ähnlich) */}
            <div className="-mx-5 mb-5 border-b border-border/50 bg-muted/20 px-5 pt-2 pb-5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={cn(
                  profileAvatarHeaderFrameClassName,
                  "group relative mx-auto size-24",
                  !avatarPreviewUrl && profileAvatarFallbackPlateClassName,
                )}
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Profilbild ändern"
              >
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreviewUrl}
                    alt=""
                    className={profileAvatarImageClassName}
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-6 text-white" aria-hidden />
                </span>
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Profilbild tippen zum {avatarPreviewUrl ? "Ändern" : "Hochladen"}
              </p>
              {displayName ? (
                <p className="mt-1 text-center text-base font-semibold tracking-tight">
                  {displayName}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="staff-given" className="text-xs">
                    Vorname
                  </Label>
                  <Input
                    id="staff-given"
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    required
                    className={staffDrawerFieldClassName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-family" className="text-xs">
                    Nachname
                  </Label>
                  <Input
                    id="staff-family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                    className={staffDrawerFieldClassName}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 pb-2">
              <FormSection title="Persönlich">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Geburtsdatum</Label>
                    <DatePickerField
                      value={birthDate || null}
                      onChange={(v) => setBirthDate(v ?? "")}
                      fullWidth
                      className="!h-11 w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-nationality">Nationalität</Label>
                    <Input
                      id="staff-nationality"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Adresse">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-address">Straße</Label>
                    <Input
                      id="staff-address"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Straße und Hausnummer"
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="staff-plz">PLZ</Label>
                      <Input
                        id="staff-plz"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className={staffDrawerFieldClassName}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="staff-city">Ort</Label>
                      <Input
                        id="staff-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={staffDrawerFieldClassName}
                      />
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Arbeit">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Position</Label>
                    <StaffPositionTagSelect
                      activeTags={activePositionTags}
                      value={positionTagId}
                      onValueChange={setPositionTagId}
                      aria-label="Position"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rolle</Label>
                    <p className="text-xs text-muted-foreground">
                      Gilt appweit für Dashboard, Display-Berechtigungen und
                      Einladungen.
                    </p>
                    <RestaurantPositionSelect
                      positions={invitePositions}
                      value={positionRoleId}
                      onValueChange={setPositionRoleId}
                      aria-label="Rolle"
                      className={staffDrawerFieldClassName}
                      placeholder="Rolle wählen …"
                    />
                  </div>
                  <div className="flex h-11 items-center justify-between rounded-xl border border-border/50 px-3">
                    <Label htmlFor="staff-active" className="cursor-pointer">
                      Aktiv
                    </Label>
                    <Switch
                      id="staff-active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                  {mode === "edit" && staff ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-left transition-colors hover:bg-muted/25"
                      onClick={goToStaffContract}
                      disabled={contractLoading}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {currentContract ? "Aktueller Vertrag" : "Verträge"}
                        </p>
                        {contractLoading ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Wird geladen …
                          </p>
                        ) : currentContract ? (
                          <>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {formatStaffContractPeriodDe(
                                currentContract.valid_from,
                                currentContract.valid_to,
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {formatContractPaySummary(currentContract)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Kein aktiver Vertrag — Verträge öffnen
                          </p>
                        )}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : null}
                </div>
              </FormSection>

              <FormSection title="Display">
                <div className="space-y-3">
                  {mode === "edit" && staff ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="staff-display-pin">Display-PIN (4 Stellen)</Label>
                      <p className="text-xs text-muted-foreground">
                        Pro Restaurant eindeutig — jede PIN darf nur einmal vergeben
                        werden. Neue PIN eingeben und unten speichern.
                      </p>
                      <div className="space-y-1.5">
                        <Input
                          id="staff-display-pin"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={4}
                          value={displayPin}
                          placeholder={hasDisplayPin ? "••••" : "1234"}
                          onChange={(e) => {
                            setClearDisplayPinOnSave(false);
                            setDisplayPin(
                              e.target.value.replace(/\D/g, "").slice(0, 4),
                            );
                          }}
                          className={staffDrawerFieldClassName}
                        />
                        {clearDisplayPinOnSave ? (
                          <p className="text-xs text-muted-foreground">
                            PIN wird beim Speichern entfernt.
                          </p>
                        ) : displayPin.length === 4 ? (
                          <p className="text-xs text-muted-foreground">
                            Neue PIN wird beim Speichern gesetzt.
                          </p>
                        ) : hasDisplayPin ? (
                          <p className="text-xs text-muted-foreground">
                            Aktuell gesetzt. Neue vier Stellen zum Ersetzen
                            eingeben.
                          </p>
                        ) : null}
                      </div>
                      {hasDisplayPin && !clearDisplayPinOnSave ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => {
                            setClearDisplayPinOnSave(true);
                            setDisplayPin("");
                          }}
                        >
                          PIN entfernen
                        </Button>
                      ) : clearDisplayPinOnSave ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          disabled={pending}
                          onClick={() => setClearDisplayPinOnSave(false)}
                        >
                          Entfernen abbrechen
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Display-PIN kann nach dem Anlegen gesetzt werden.
                    </p>
                  )}
                </div>
              </FormSection>

              <FormSection title="Kontakt">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-email">E-Mail</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={staffDrawerFieldClassName}
                    />
                    {mode === "edit" &&
                    staff &&
                    !staff.profile_id &&
                    contactConflicts?.emailConflict ? (
                      <StaffInviteContactConflictNotice
                        conflict={contactConflicts.emailConflict}
                        channel="email"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-phone-local">Telefon</Label>
                    <GuestPhoneField
                      countryId="staff-phone-country"
                      localId="staff-phone-local"
                      countryIso={phoneIso}
                      onCountryChange={setPhoneIso}
                      localValue={phoneLocal}
                      onLocalChange={setPhoneLocal}
                      countries={countries}
                    />
                    {mode === "edit" &&
                    staff &&
                    !staff.profile_id &&
                    contactConflicts?.phoneConflict ? (
                      <StaffInviteContactConflictNotice
                        conflict={contactConflicts.phoneConflict}
                        channel="phone"
                      />
                    ) : null}
                  </div>
                </div>
              </FormSection>

              {mode === "edit" && staff && staff.profile_id ? (
                <FormSection title="App-Account">
                  <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <p className="text-sm font-medium">
                      {linkedProfileLabel ?? "Verbunden"}
                    </p>
                    {!linkedEmployeeActive ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Restaurant-Zugang ist deaktiviert.
                      </p>
                    ) : null}
                    {canManageTeam ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={revokeBusy}
                        onClick={() => setRevokeOpen(true)}
                      >
                        {revokeBusy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <LogOut className="size-4" />
                        )}
                        Zugang entziehen
                      </Button>
                    ) : null}
                  </div>
                </FormSection>
              ) : null}

              {mode === "edit" && staff && !staff.profile_id ? (
                <FormSection title="Einladung">
                  <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <p className="text-xs text-muted-foreground">
                      {selectedPosition ? (
                        <>
                          Einladung mit Rolle{" "}
                          <span className="font-medium text-foreground">
                            {formatRestaurantPositionLabel(selectedPosition)}
                          </span>{" "}
                          — Link kopieren oder direkt senden, wenn Integrationen
                          aktiv sind.
                        </>
                      ) : (
                        "Bitte unter Arbeit eine Rolle wählen."
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl"
                        disabled={inviteBusy != null || !positionRoleId}
                        onClick={() => handleInvite("copy")}
                      >
                        {inviteBusy === "copy" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                        Link kopieren
                      </Button>
                      {canSendWhatsapp ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 rounded-xl"
                          disabled={inviteBusy != null || !positionRoleId}
                          onClick={() => handleInvite("whatsapp")}
                        >
                          {inviteBusy === "whatsapp" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <MessageCircle className="size-4" />
                          )}
                          WhatsApp senden
                        </Button>
                      ) : null}
                      {canSendEmail ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 rounded-xl"
                          disabled={inviteBusy != null || !positionRoleId}
                          onClick={() => handleInvite("email")}
                        >
                          {inviteBusy === "email" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Mail className="size-4" />
                          )}
                          E-Mail senden
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </FormSection>
              ) : null}

              {mode === "edit" && staff ? (
                <FormSection title="Protokoll">
                  {logLoading ? (
                    <p className="text-sm text-muted-foreground">Wird geladen …</p>
                  ) : logEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Einträge — Änderungen erscheinen nach dem Speichern.
                    </p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-muted/15 p-3">
                      {logEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="border-b border-border/30 pb-2 text-sm last:border-0 last:pb-0"
                        >
                          <p className="font-medium">
                            {formatStaffAuditLogActionLabel(entry.action)}
                            {" · "}
                            <span className="font-normal text-muted-foreground">
                              {whenFmt.format(new Date(entry.created_at))}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatStaffAuditLogActorLabel(entry.details)}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed">
                            {entry.details.summary ??
                              formatStaffAuditLogSummary(
                                entry.action,
                                entry.details.changes ?? [],
                              )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </FormSection>
              ) : null}
            </div>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitPending={pending}
            submitDisabled={!givenName.trim() || !familyName.trim()}
            submitLabel={mode === "create" ? "Anlegen" : "Speichern"}
          />
        </form>
      </DrawerContent>

      <ConfirmDialog
        open={inviteConflictConfirmOpen}
        onOpenChange={(nextOpen) => {
          setInviteConflictConfirmOpen(nextOpen);
          if (!nextOpen) setPendingInviteAction(null);
        }}
        title={
          pendingInviteAction === "whatsapp"
            ? "Trotzdem per WhatsApp senden?"
            : "Trotzdem per E-Mail senden?"
        }
        description={
          pendingInviteAction === "whatsapp" &&
          contactConflicts?.phoneConflict ? (
            staffInviteContactConflictHint(
              contactConflicts.phoneConflict,
              "phone",
            )
          ) : pendingInviteAction === "email" &&
            contactConflicts?.emailConflict ? (
            staffInviteContactConflictHint(
              contactConflicts.emailConflict,
              "email",
            )
          ) : (
            "Der Kontakt ist bereits mit einem App-Account verbunden."
          )
        }
        confirmLabel={
          pendingInviteAction === "whatsapp" ? "WhatsApp senden" : "E-Mail senden"
        }
        destructive={false}
        confirmDisabled={inviteBusy != null}
        onConfirm={() => {
          const action = pendingInviteAction;
          setPendingInviteAction(null);
          if (action) void runInvite(action);
        }}
      />

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="App-Zugang entziehen?"
        description={
          linkedProfileLabel ? (
            <>
              <span className="font-medium text-foreground">
                {linkedProfileLabel}
              </span>{" "}
              verliert den Zugang zu diesem Restaurant. Eine neue Einladung ist
              danach wieder möglich.
            </>
          ) : (
            "Der verknüpfte App-Account verliert den Zugang zu diesem Restaurant."
          )
        }
        confirmLabel="Zugang entziehen"
        destructive
        confirmDisabled={revokeBusy}
        onConfirm={handleRevokeAccess}
      />
    </Drawer>
  );
}
