"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReservationStatusLabel } from "@/components/reservations/reservation-status-label";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  type CountryReference,
} from "@/lib/constants/countries";
import { fetchCountries } from "@/lib/supabase/countries-db";
import { formatGuestPhone, parseGuestPhone } from "@/lib/phone/guest-phone";
import {
  contactDisplayName,
  deleteContact,
  fetchContactById,
  insertContact,
  updateContact,
  type ContactDetail,
} from "@/lib/supabase/contacts-db";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import type { ContactCreateDraft } from "@/lib/contact-messages/draft-from-waha-chat";
import { isInvalidContactEmailValue } from "@/lib/contacts/contact-identity-conflict";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { cn } from "@/lib/utils";

type EmailDraft = { key: string; email: string; label: string };
type PhoneDraft = { key: string; iso2: string; local: string; label: string };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyEmail(): EmailDraft {
  return { key: newKey(), email: "", label: "" };
}

function emptyPhone(defaultIso2: string): PhoneDraft {
  return { key: newKey(), iso2: defaultIso2, local: "", label: "" };
}

type FormSnapshotPayload = {
  firstName: string;
  lastName: string;
  company: string;
  addressStreet: string;
  addressPostalCode: string;
  addressCity: string;
  addressCountry: string;
  notes: string;
  emails: Array<{ email: string; label: string }>;
  phones: Array<{ iso2: string; local: string; label: string }>;
};

function serializeFormSnapshot(payload: FormSnapshotPayload): string {
  return JSON.stringify(payload);
}

function emptyFormSnapshot(defaultIso2: string): string {
  return serializeFormSnapshot({
    firstName: "",
    lastName: "",
    company: "",
    addressStreet: "",
    addressPostalCode: "",
    addressCity: "",
    addressCountry: "",
    notes: "",
    emails: [{ email: "", label: "" }],
    phones: [{ iso2: defaultIso2, local: "", label: "" }],
  });
}

function formatReservationWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactEditDrawer({
  open,
  onOpenChange,
  contactId,
  restaurantId,
  defaultCountryIso2,
  initialDraft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  restaurantId: string;
  defaultCountryIso2: string;
  /** Vorausfüllung beim Anlegen (z. B. aus WhatsApp-Chat). */
  initialDraft?: ContactCreateDraft | null;
  onSaved?: (detail?: { contactId: string; created: boolean }) => void;
}) {
  const isEdit = contactId != null;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [notes, setNotes] = useState("");
  const savedSnapshotRef = useRef<string | null>(null);
  const [emails, setEmails] = useState<EmailDraft[]>([emptyEmail()]);
  const [phones, setPhones] = useState<PhoneDraft[]>([emptyPhone(defaultCountryIso2)]);
  const [countries, setCountries] = useState<CountryReference[]>(
    COUNTRIES_REFERENCE_FALLBACK,
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmDeleteOpen(false);
      savedSnapshotRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    void fetchCountries().then(({ data }) => {
      if (data.length > 0) setCountries(data);
    });
  }, []);

  const currentSnapshot = useMemo(
    () =>
      serializeFormSnapshot({
        firstName,
        lastName,
        company,
        addressStreet,
        addressPostalCode,
        addressCity,
        addressCountry,
        notes,
        emails: emails.map((e) => ({ email: e.email, label: e.label })),
        phones: phones.map((p) => ({
          iso2: p.iso2,
          local: p.local,
          label: p.label,
        })),
      }),
    [
      firstName,
      lastName,
      company,
      addressStreet,
      addressPostalCode,
      addressCity,
      addressCountry,
      notes,
      emails,
      phones,
    ],
  );

  const dirty =
    savedSnapshotRef.current !== null &&
    !loading &&
    currentSnapshot !== savedSnapshotRef.current;

  const fieldClass =
    "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setDetail(null);
      const draft = initialDraft;
      setFirstName(draft?.firstName ?? "");
      setLastName(draft?.lastName ?? "");
      setCompany("");
      setAddressStreet("");
      setAddressPostalCode("");
      setAddressCity("");
      setAddressCountry("");
      setNotes("");
      setEmails(
        draft?.emails?.length
          ? draft.emails.map((e) => ({
              key: newKey(),
              email: e.email,
              label: e.label ?? "",
            }))
          : [emptyEmail()],
      );
      setPhones(
        draft?.phones?.length
          ? draft.phones.map((p) => ({
              key: newKey(),
              iso2: p.iso2,
              local: p.local,
              label: p.label ?? "",
            }))
          : [emptyPhone(defaultCountryIso2)],
      );
      savedSnapshotRef.current = emptyFormSnapshot(defaultCountryIso2);
      return;
    }
    if (!contactId) return;
    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchContactById({
        restaurantId,
        contactId,
      });
      if (cancel) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        toast.error("Kontakt nicht gefunden.");
        onOpenChange(false);
        return;
      }
      setDetail(data);
      setFirstName(data.first_name);
      setLastName(data.last_name);
      setCompany(data.company ?? "");
      setAddressStreet(data.address_street ?? "");
      setAddressPostalCode(data.address_postal_code ?? "");
      setAddressCity(data.address_city ?? "");
      setAddressCountry(data.address_country ?? "");
      setNotes(data.notes ?? "");
      setEmails(
        data.contact_emails.length > 0
          ? data.contact_emails
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((e) => ({
                key: e.id,
                email: e.email,
                label: e.label ?? "",
              }))
          : [emptyEmail()],
      );
      setPhones(
        data.contact_phones.length > 0
          ? data.contact_phones
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((p) => {
                const parsed = parseGuestPhone(
                  p.phone_display,
                  countries,
                  p.country_iso2 ?? defaultCountryIso2,
                );
                return {
                  key: p.id,
                  iso2: parsed.iso2,
                  local: parsed.local,
                  label: p.label ?? "",
                };
              })
          : [emptyPhone(defaultCountryIso2)],
      );
      savedSnapshotRef.current = serializeFormSnapshot({
        firstName: data.first_name,
        lastName: data.last_name,
        company: data.company ?? "",
        addressStreet: data.address_street ?? "",
        addressPostalCode: data.address_postal_code ?? "",
        addressCity: data.address_city ?? "",
        addressCountry: data.address_country ?? "",
        notes: data.notes ?? "",
        emails:
          data.contact_emails.length > 0
            ? data.contact_emails
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((e) => ({ email: e.email, label: e.label ?? "" }))
            : [{ email: "", label: "" }],
        phones:
          data.contact_phones.length > 0
            ? data.contact_phones
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((p) => {
                  const parsed = parseGuestPhone(
                    p.phone_display,
                    countries,
                    p.country_iso2 ?? defaultCountryIso2,
                  );
                  return {
                    iso2: parsed.iso2,
                    local: parsed.local,
                    label: p.label ?? "",
                  };
                })
            : [{ iso2: defaultCountryIso2, local: "", label: "" }],
      });
    })();
    return () => {
      cancel = true;
    };
  }, [open, isEdit, contactId, restaurantId, countries, defaultCountryIso2, onOpenChange]);

  const title = isEdit
    ? detail
      ? contactDisplayName(detail)
      : "Kontakt"
    : "Neuer Kontakt";

  const buildPayload = () => {
    const seenEmailNorms = new Set<string>();
    const emailRows = emails
      .map((e) => ({ email: e.email.trim(), label: e.label.trim() || null }))
      .filter((e) => e.email.length > 0)
      .filter((e) => {
        const norm = normalizeContactEmail(e.email);
        if (!norm || seenEmailNorms.has(norm)) return false;
        seenEmailNorms.add(norm);
        return true;
      });
    const phoneRows = phones
      .map((p) => {
        const display = formatGuestPhone(p.iso2, p.local, countries);
        if (!display) return null;
        return {
          phoneDisplay: display,
          countryIso2: p.iso2,
          label: p.label.trim() || null,
        };
      })
      .filter(Boolean) as Array<{
      phoneDisplay: string;
      countryIso2: string;
      label: string | null;
    }>;

    if (emailRows.length === 0 && phoneRows.length === 0) {
      toast.error("Mindestens eine E-Mail oder Telefonnummer angeben.");
      return null;
    }

    for (const e of emailRows) {
      if (!e.email.includes("@")) {
        toast.error("Bitte gültige E-Mail-Adressen eingeben.");
        return null;
      }
      if (isInvalidContactEmailValue(e.email)) {
        toast.error(
          "Das ist keine E-Mail-Adresse — WhatsApp-IDs und Nummern bitte unter Telefon eintragen.",
        );
        return null;
      }
    }

    return {
      restaurantId,
      firstName: firstName.trim() || "Gast",
      lastName: lastName.trim(),
      company: company.trim() || null,
      addressStreet: addressStreet.trim() || null,
      addressPostalCode: addressPostalCode.trim() || null,
      addressCity: addressCity.trim() || null,
      addressCountry: addressCountry.trim() || null,
      notes: notes.trim() || null,
      emails: emailRows.map((e, i) => ({
        email: e.email,
        label: e.label,
        isPrimary: i === 0,
      })),
      phones: phoneRows.map((p, i) => ({
        phoneDisplay: p.phoneDisplay,
        countryIso2: p.countryIso2,
        label: p.label,
        isPrimary: i === 0,
      })),
    };
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    void (async () => {
      if (isEdit && contactId) {
        const { error } = await updateContact(contactId, payload);
        setSaving(false);
        if (error) toast.error(error.message);
        else {
          toast.success("Kontakt gespeichert.");
          savedSnapshotRef.current = currentSnapshot;
          onSaved?.({ contactId, created: false });
          onOpenChange(false);
        }
        return;
      }
      const { data: created, error } = await insertContact(payload);
      setSaving(false);
      if (error) toast.error(error.message);
      else if (created?.id) {
        toast.success("Kontakt angelegt.");
        onSaved?.({ contactId: created.id, created: true });
        onOpenChange(false);
      }
    })();
  };

  const handleDelete = () => {
    if (!contactId) return;
    setSaving(true);
    void (async () => {
      const { error } = await deleteContact({ restaurantId, contactId });
      setSaving(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Kontakt gelöscht.");
        setConfirmDeleteOpen(false);
        onSaved?.();
        onOpenChange(false);
      }
    })();
  };

  const linkedReservations = detail?.reservations ?? [];

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-xl font-semibold tracking-tight">
                  {title}
                </DrawerTitle>
                <DrawerDescription className="text-base">
                  {isEdit
                    ? "Stammdaten, Kanäle und verknüpfte Reservierungen."
                    : "Kontakt mit E-Mail, Telefon und optionaler Adresse anlegen."}
                </DrawerDescription>
              </div>
              {isEdit && contactId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Kontakt löschen"
                  disabled={saving || loading}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </DrawerHeader>

          {open ? (
            <>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vorname</Label>
                <Input
                  value={firstName}
                  disabled={loading}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nachname</Label>
                <Input
                  value={lastName}
                  disabled={loading}
                  onChange={(e) => setLastName(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Firma (optional)</Label>
              <Input
                value={company}
                disabled={loading}
                onChange={(e) => setCompany(e.target.value)}
                className={fieldClass}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border/40 bg-background/60 p-3 dark:bg-background/40">
              <p className="text-sm font-medium">Adresse (optional)</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Straße & Hausnummer
                </Label>
                <Input
                  value={addressStreet}
                  disabled={loading}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">PLZ</Label>
                  <Input
                    value={addressPostalCode}
                    disabled={loading}
                    onChange={(e) => setAddressPostalCode(e.target.value)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ort</Label>
                  <Input
                    value={addressCity}
                    disabled={loading}
                    onChange={(e) => setAddressCity(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Land</Label>
                <Input
                  value={addressCountry}
                  disabled={loading}
                  onChange={(e) => setAddressCountry(e.target.value)}
                  placeholder="z. B. Deutschland"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">E-Mail-Adressen</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={loading}
                  onClick={() => setEmails((list) => [...list, emptyEmail()])}
                >
                  <Plus className="size-3.5" />
                  Hinzufügen
                </Button>
              </div>
              {emails.map((row, idx) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-lg border border-border/40 p-3 sm:grid-cols-[1fr_6rem_auto]"
                >
                  <Input
                    type="email"
                    placeholder="name@beispiel.de"
                    value={row.email}
                    disabled={loading}
                    onChange={(e) =>
                      setEmails((list) =>
                        list.map((x) =>
                          x.key === row.key ? { ...x, email: e.target.value } : x,
                        ),
                      )
                    }
                    className="h-10 rounded-xl font-mono text-sm"
                  />
                  <Input
                    placeholder="Label"
                    value={row.label}
                    disabled={loading}
                    onChange={(e) =>
                      setEmails((list) =>
                        list.map((x) =>
                          x.key === row.key ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                    className="h-10 rounded-xl text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={loading || emails.length <= 1}
                    onClick={() =>
                      setEmails((list) => list.filter((x) => x.key !== row.key))
                    }
                    aria-label="E-Mail entfernen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  {idx === 0 ? (
                    <span className="text-[10px] text-muted-foreground sm:col-span-3">
                      Erste Adresse = primär
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Telefonnummern</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={loading}
                  onClick={() =>
                    setPhones((list) => [...list, emptyPhone(defaultCountryIso2)])
                  }
                >
                  <Plus className="size-3.5" />
                  Hinzufügen
                </Button>
              </div>
              {phones.map((row, idx) => (
                  <div
                    key={row.key}
                    className="space-y-2 rounded-lg border border-border/40 p-3"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <GuestPhoneField
                        className="min-w-0 flex-1 basis-48"
                        countryIso={row.iso2}
                        countries={countries}
                        disabled={loading}
                        localValue={row.local}
                        onCountryChange={(iso2) =>
                          setPhones((list) =>
                            list.map((x) =>
                              x.key === row.key ? { ...x, iso2 } : x,
                            ),
                          )
                        }
                        onLocalChange={(local) =>
                          setPhones((list) =>
                            list.map((x) =>
                              x.key === row.key ? { ...x, local } : x,
                            ),
                          )
                        }
                      />
                      <Input
                        placeholder="Label"
                        value={row.label}
                        disabled={loading}
                        onChange={(e) =>
                          setPhones((list) =>
                            list.map((x) =>
                              x.key === row.key ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                        className="h-11 w-24 shrink-0 rounded-xl text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        disabled={loading || phones.length <= 1}
                        onClick={() =>
                          setPhones((list) => list.filter((x) => x.key !== row.key))
                        }
                        aria-label="Telefon entfernen"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {idx === 0 ? (
                      <p className="text-[10px] text-muted-foreground">
                        Erste Nummer = primär
                      </p>
                    ) : null}
                  </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notizen</Label>
              <Textarea
                value={notes}
                disabled={loading}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="rounded-xl resize-y min-h-[5rem]"
              />
            </div>

            {isEdit && detail && detail.message_count > 0 ? (
              <div className="space-y-2 border-t border-border/50 pt-4">
                <p className="text-sm font-medium">Nachrichten</p>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">
                      {detail.message_count}
                    </span>{" "}
                    Nachricht{detail.message_count === 1 ? "" : "en"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    render={
                      <Link
                        href={`/dashboard/kontakte/nachrichten?contact=${detail.id}`}
                        prefetch
                      />
                    }
                  >
                    <MessageSquare className="size-3.5" />
                    Öffnen
                  </Button>
                </div>
              </div>
            ) : null}

            {isEdit && linkedReservations.length > 0 ? (
              <div className="space-y-2 border-t border-border/50 pt-4">
                <p className="text-sm font-medium">Reservierungen</p>
                <ul className="space-y-2">
                  {linkedReservations.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium tabular-nums">
                          #{r.reservation_number} · {r.party_size} Pers.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatReservationWhen(r.starts_at)}
                        </p>
                        {r.reservation_statuses ? (
                          <ReservationStatusLabel
                            status={r.reservation_statuses}
                            compact
                          />
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        render={
                          <Link
                            href={`/dashboard/reservierungen/uebersicht?reservation=${r.id}`}
                            prefetch
                          />
                        }
                      >
                        Öffnen
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : isEdit && !loading ? (
              <p className="text-xs text-muted-foreground border-t border-border/50 pt-4">
                Noch keine verknüpften Reservierungen. Neue Reservierungen mit
                passender E-Mail oder Telefonnummer werden automatisch verknüpft.
              </p>
            ) : null}
          </div>

          {dirty ? (
            <div
              className={cn(
                "shrink-0 border-t border-border/60 bg-background/90 px-6 py-3 backdrop-blur-md",
                "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
                "shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.45)]",
              )}
              role="region"
              aria-label="Ungespeicherte Änderungen"
            >
              <Button
                type="button"
                disabled={saving || loading}
                className={cn("h-11 w-full rounded-xl", settingsAccentSaveButtonClassName)}
                onClick={handleSave}
              >
                Speichern
              </Button>
            </div>
          ) : null}
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Kontakt wirklich löschen?"
        description={
          detail ? (
            <>
              „
              <span className="font-medium text-foreground">
                {contactDisplayName(detail)}
              </span>
              “ wird dauerhaft entfernt. Verknüpfungen zu Reservierungen werden
              gelöst, die Reservierungen bleiben erhalten.
            </>
          ) : (
            "Verknüpfungen zu Reservierungen werden gelöst, die Reservierungen bleiben erhalten."
          )
        }
        confirmLabel="Ja, löschen"
        confirmDisabled={saving}
        onConfirm={handleDelete}
      />
    </>
  );
}
