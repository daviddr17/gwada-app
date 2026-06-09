"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountingContactRecipientFields } from "@/components/accounting/accounting-contact-recipient-fields";
import { AccountingFormSection } from "@/components/accounting/accounting-form-section";
import { AccountingLineItemsEditor } from "@/components/accounting/accounting-line-items-editor";
import { AccountingSendSection } from "@/components/accounting/accounting-send-section";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ALL_CONTACT_RECIPIENT_FIELDS_EDITABLE,
  collectContactRecipientPatches,
  formatContactPatchToast,
  originallyEmptyContactFields,
  originallyEmptyFromRecipientSnapshot,
  recipientFromUnifiedContact,
  type ContactOriginallyEmptyFields,
} from "@/lib/accounting/accounting-contact-recipient";
import {
  createContactFromAccountingRecipient,
  patchContactFieldsFromAccounting,
} from "@/lib/accounting/accounting-contact-recipient-api";
import {
  resolveStoredVoucherDate,
  voucherDateKindOptions,
} from "@/lib/accounting/accounting-voucher-date";
import {
  isMenuCurrencyCode,
  MENU_CURRENCY_OPTIONS,
} from "@/lib/constants/menu-currencies";
import { computeDocumentTotals } from "@/lib/accounting/compute-line-totals";
import { createEmptyLineItem } from "@/lib/accounting/default-catalog";
import {
  unifiedContactOptionLabel,
  type UnifiedContactListRow,
} from "@/lib/contacts/unified-contact-row";
import { useAccountingContacts } from "@/lib/hooks/use-accounting-contacts";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import {
  accountingFormControlClassName,
  accountingFormGridClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";
import type {
  AccountingArticleRow,
  AccountingInvoiceRow,
  AccountingInvoiceStatus,
  AccountingLineItem,
  AccountingQuotationRow,
  AccountingQuotationStatus,
  AccountingRecipientSnapshot,
  AccountingSalesDocumentInput,
  AccountingTaxMode,
  AccountingTaxRateRow,
  AccountingUnitRow,
  AccountingVoucherDateKind,
} from "@/lib/types/accounting";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

type AccountingSalesDocumentDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentKind: "invoice" | "quotation";
  restaurantId: string;
  editRow: SalesDocumentRow | null;
  taxRates: AccountingTaxRateRow[];
  units: AccountingUnitRow[];
  articles: AccountingArticleRow[];
  lexofficeConnected: boolean;
  onSaved: () => void;
  onCreate: (input: AccountingSalesDocumentInput) => Promise<void>;
  onUpdate: (
    id: string,
    input: Partial<AccountingSalesDocumentInput> & { status?: string },
  ) => Promise<void>;
};

const TAX_MODE_OPTIONS = [
  { value: "net", label: "Netto" },
  { value: "gross", label: "Brutto" },
  { value: "vatfree", label: "Steuerfrei" },
];

const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Entwurf" },
  { value: "open", label: "Offen" },
  { value: "sent", label: "Verschickt" },
  { value: "paid", label: "Bezahlt" },
  { value: "overdue", label: "Überfällig" },
  { value: "voided", label: "Storniert" },
];

const QUOTATION_STATUS_OPTIONS = [
  { value: "draft", label: "Entwurf" },
  { value: "open", label: "Offen" },
  { value: "sent", label: "Verschickt" },
  { value: "accepted", label: "Angenommen" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "voided", label: "Storniert" },
];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AccountingSalesDocumentDrawer({
  open,
  onOpenChange,
  documentKind,
  restaurantId,
  editRow,
  taxRates,
  units,
  articles,
  lexofficeConnected,
  onSaved,
  onCreate,
  onUpdate,
}: AccountingSalesDocumentDrawerProps) {
  const { contacts, reload: reloadContacts } = useAccountingContacts(
    open ? restaurantId : null,
  );
  const readOnlyLexoffice = editRow?.source === "lexoffice";
  const defaultTax = taxRates.find((t) => t.is_default)?.rate_percent ?? 0;

  const [recipientType, setRecipientType] = useState<"contact" | "one_time">(
    "contact",
  );
  const [contactRowKey, setContactRowKey] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [lexofficeContactId, setLexofficeContactId] = useState<string | null>(
    null,
  );
  const [recipient, setRecipient] = useState<AccountingRecipientSnapshot>({
    name: "",
    countryCode: "DE",
  });
  const [voucherDate, setVoucherDate] = useState(todayYmd());
  const [voucherDateKind, setVoucherDateKind] =
    useState<AccountingVoucherDateKind>("date");
  const [voucherPeriodStart, setVoucherPeriodStart] = useState<string | null>(
    null,
  );
  const [voucherPeriodEnd, setVoucherPeriodEnd] = useState<string | null>(
    null,
  );
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [taxMode, setTaxMode] = useState<AccountingTaxMode>("net");
  const [currency, setCurrency] = useState("EUR");
  const [lineItems, setLineItems] = useState<AccountingLineItem[]>([
    createEmptyLineItem({ taxRatePercent: defaultTax }),
  ]);
  const [status, setStatus] = useState<
    AccountingInvoiceStatus | AccountingQuotationStatus
  >("draft");
  const [syncToLexoffice, setSyncToLexoffice] = useState(false);
  const [finalizeOnCreate, setFinalizeOnCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sentEditAck, setSentEditAck] = useState(false);
  const [contactOriginallyEmpty, setContactOriginallyEmpty] =
    useState<ContactOriginallyEmptyFields | null>(null);
  const [saveNewContact, setSaveNewContact] = useState(false);
  const [sendOnSave, setSendOnSave] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  const { whatsappConnected } = useRestaurantChannelConnections(
    open ? restaurantId : null,
  );

  useEffect(() => {
    if (!open || !editRow?.contact_id || contacts.length === 0) return;
    const match = contacts.find(
      (c) => c.gwadaContactId === editRow.contact_id,
    );
    if (!match) return;
    setContactRowKey(match.rowKey);
    setLexofficeContactId(match.lexofficeContactId);
    if (!contactOriginallyEmpty) {
      setContactOriginallyEmpty(originallyEmptyContactFields(match));
    }
  }, [open, editRow, contacts, contactOriginallyEmpty]);

  const contactOptions = useMemo(
    () =>
      contacts.map((row) => ({
        value: row.rowKey,
        label: unifiedContactOptionLabel(row),
        leadingPlatforms: row.platforms,
      })),
    [contacts],
  );

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setRecipientType(editRow.recipient_type);
      setContactId(editRow.contact_id);
      setContactRowKey(editRow.contact_id ?? null);
      setLexofficeContactId(null);
      setRecipient(editRow.recipient_snapshot ?? { name: "" });
      setVoucherDate(editRow.voucher_date);
      setVoucherDateKind(editRow.voucher_date_kind ?? "date");
      setVoucherPeriodStart(editRow.voucher_period_start ?? null);
      setVoucherPeriodEnd(editRow.voucher_period_end ?? null);
      setDueDate(
        documentKind === "invoice" && "due_date" in editRow
          ? editRow.due_date
          : documentKind === "quotation" && "expiration_date" in editRow
            ? editRow.expiration_date
            : null,
      );
      setDeliveryDate(editRow.delivery_date ?? null);
      setTaxMode(editRow.tax_mode);
      setCurrency(editRow.currency);
      setLineItems(
        editRow.line_items?.length
          ? editRow.line_items
          : [createEmptyLineItem({ taxRatePercent: defaultTax })],
      );
      setStatus(editRow.status);
      setSyncToLexoffice(false);
      setFinalizeOnCreate(false);
      setSentEditAck(false);
      setContactOriginallyEmpty(null);
      setSaveNewContact(false);
      return;
    }
    setRecipientType("contact");
    setContactRowKey(null);
    setContactId(null);
    setLexofficeContactId(null);
    setContactOriginallyEmpty(null);
    setRecipient({ name: "", countryCode: "DE" });
    setVoucherDate(todayYmd());
    setVoucherDateKind("date");
    setVoucherPeriodStart(null);
    setVoucherPeriodEnd(null);
    setDueDate(null);
    setDeliveryDate(null);
    setTaxMode("net");
    setCurrency("EUR");
    setLineItems([createEmptyLineItem({ taxRatePercent: defaultTax })]);
    setStatus("draft");
    setSyncToLexoffice(false);
    setFinalizeOnCreate(false);
    setSentEditAck(false);
    setSaveNewContact(false);
    setSendOnSave(false);
    setSendEmail(false);
    setSendWhatsapp(false);
  }, [open, editRow, defaultTax, documentKind]);

  const totals = useMemo(
    () => computeDocumentTotals(lineItems, taxMode, currency),
    [lineItems, taxMode, currency],
  );

  const wasSent = Boolean(editRow?.sent_at);
  const needsSentAck = wasSent && !sentEditAck && !readOnlyLexoffice;
  const selectedContact = useMemo(
    () =>
      contacts.find(
        (c) =>
          c.rowKey === contactRowKey ||
          (contactId && c.gwadaContactId === contactId),
      ) ?? null,
    [contacts, contactRowKey, contactId],
  );

  const applyContactSelection = (rowKey: string) => {
    const row = contacts.find((c) => c.rowKey === rowKey);
    if (!row) return;
    setContactRowKey(rowKey);
    setContactId(row.gwadaContactId);
    setLexofficeContactId(row.lexofficeContactId);
    setContactOriginallyEmpty(originallyEmptyContactFields(row));
    setRecipient(recipientFromUnifiedContact(row));
  };

  const voucherDateKindSelectOptions = useMemo(
    () => voucherDateKindOptions(documentKind),
    [documentKind],
  );

  const currencyOptions = useMemo(() => {
    const options = MENU_CURRENCY_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
    }));
    if (currency && !isMenuCurrencyCode(currency)) {
      return [{ value: currency, label: currency }, ...options];
    }
    return options;
  }, [currency]);

  const buildInput = (): AccountingSalesDocumentInput => {
    const storedVoucherDate = resolveStoredVoucherDate({
      voucherDateKind,
      voucherDate,
      voucherPeriodEnd,
    });

    return {
      recipientType,
      contactId,
      lexofficeContactId,
      recipient,
      voucherDate: storedVoucherDate,
      voucherDateKind,
      voucherPeriodStart:
        voucherDateKind === "period" ? voucherPeriodStart : null,
      voucherPeriodEnd: voucherDateKind === "period" ? voucherPeriodEnd : null,
      dueDate: documentKind === "invoice" ? dueDate : undefined,
      deliveryDate,
      expirationDate: documentKind === "quotation" ? dueDate : undefined,
      currency,
      taxMode,
      lineItems,
      syncToLexoffice: !editRow && syncToLexoffice,
      finalizeOnCreate: !editRow && finalizeOnCreate,
      sendOnSave: !editRow && sendOnSave,
      sendEmail: sendOnSave && sendEmail,
      sendWhatsapp: sendOnSave && sendWhatsapp,
      status,
    };
  };

  const handleSave = async () => {
    if (!recipient.name.trim()) {
      toast.error("Empfänger fehlt — Kontakt wählen oder Name eingeben.");
      return;
    }
    if (lineItems.every((l) => l.type === "text" || !l.name.trim())) {
      toast.error("Mindestens eine Position mit Bezeichnung erforderlich.");
      return;
    }
    if (voucherDateKind === "period") {
      if (!voucherPeriodStart || !voucherPeriodEnd) {
        toast.error(
          documentKind === "invoice"
            ? "Bitte Rechnungszeitraum von und bis angeben."
            : "Bitte Angebotszeitraum von und bis angeben.",
        );
        return;
      }
      if (voucherPeriodStart > voucherPeriodEnd) {
        toast.error("Der Zeitraum-Start darf nicht nach dem Ende liegen.");
        return;
      }
    }
    if (needsSentAck) {
      toast.error("Bitte bestätigen Sie die Änderung an einem verschickten Dokument.");
      return;
    }
    setSaving(true);
    try {
      let effectiveContactId = contactId;
      let effectiveRecipientType = recipientType;
      let contactPatchLabel: string | null = null;
      let createdContact = false;

      if (
        !editRow &&
        recipientType === "one_time" &&
        saveNewContact
      ) {
        if (!recipient.email?.trim() && !recipient.phone?.trim()) {
          toast.error(
            "Zum Speichern des Kontakts mindestens E-Mail oder Telefon angeben.",
          );
          return;
        }
        if (recipient.email?.trim() && !recipient.email.includes("@")) {
          toast.error("Bitte gültige E-Mail eingeben.");
          return;
        }
        const createResult = await createContactFromAccountingRecipient({
          restaurantId,
          recipient,
        });
        if (createResult.error || !createResult.contactId) {
          toast.error(
            createResult.error ?? "Kontakt konnte nicht angelegt werden.",
          );
          return;
        }
        effectiveContactId = createResult.contactId;
        effectiveRecipientType = "contact";
        createdContact = true;
        await reloadContacts();
      }

      if (
        !editRow &&
        recipientType === "contact" &&
        selectedContact &&
        contactOriginallyEmpty
      ) {
        const pendingPatches = collectContactRecipientPatches(
          contactOriginallyEmpty,
          recipient,
        );
        if (
          pendingPatches.includes("email") &&
          recipient.email &&
          !recipient.email.includes("@")
        ) {
          toast.error("Bitte gültige E-Mail für den Kontakt eingeben.");
          return;
        }
        if (pendingPatches.length > 0) {
          const patchResult = await patchContactFieldsFromAccounting({
            restaurantId,
            selectedContact,
            originallyEmpty: contactOriginallyEmpty,
            recipient,
          });
          if (patchResult.error) {
            toast.error(patchResult.error);
            return;
          }
          if (patchResult.contactId) {
            effectiveContactId = patchResult.contactId;
            setContactId(patchResult.contactId);
          }
          if (patchResult.updatedFields.length > 0) {
            contactPatchLabel = formatContactPatchToast(
              patchResult.updatedFields,
            );
            await reloadContacts();
          }
        }
      }

      const input: AccountingSalesDocumentInput = {
        ...buildInput(),
        recipientType: effectiveRecipientType,
        contactId: effectiveContactId,
      };

      if (editRow) {
        await onUpdate(editRow.id, { ...input, status });
        toast.success(
          documentKind === "invoice"
            ? "Rechnung gespeichert."
            : "Angebot gespeichert.",
        );
      } else {
        await onCreate(input);
        const docLabel =
          documentKind === "invoice" ? "Rechnung angelegt" : "Angebot angelegt";
        if (contactPatchLabel) {
          toast.success(
            `${docLabel}. Kontakt ergänzt: ${contactPatchLabel}.`,
          );
        } else if (createdContact) {
          toast.success(`${docLabel}. Kontakt gespeichert.`);
        } else {
          toast.success(`${docLabel}.`);
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSaving(false);
    }
  };

  const title =
    documentKind === "invoice"
      ? editRow
        ? "Rechnung bearbeiten"
        : "Neue Rechnung"
      : editRow
        ? "Angebot bearbeiten"
        : "Neues Angebot";

  const statusOptions =
    documentKind === "invoice"
      ? INVOICE_STATUS_OPTIONS
      : QUOTATION_STATUS_OPTIONS;

  const secondaryDateLabel =
    documentKind === "invoice" ? "Fällig am" : "Gültig bis";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-3xl">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>
            {readOnlyLexoffice
              ? "Lexware-Dokument — Bearbeitung nur in Lexware."
              : "Empfänger, Konditionen und Positionen in gruppierten Abschnitten."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {readOnlyLexoffice ? (
            <p className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Änderungen nur direkt in Lexware möglich. Nutzen Sie „In Lexware“
              in der Liste.
            </p>
          ) : (
            <div className="space-y-4">
              {wasSent ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    Bereits verschickt
                  </p>
                  <label className="mt-2 flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={sentEditAck}
                      onCheckedChange={(v) => setSentEditAck(v === true)}
                    />
                    <span>Trotzdem bearbeiten</span>
                  </label>
                </div>
              ) : null}

              <AccountingFormSection title="Empfänger">
                <div className={accountingFormGridClassName}>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Empfängerart</Label>
                    <SearchableSelect
                      value={recipientType}
                      onValueChange={(v) => {
                        const next = v as "contact" | "one_time";
                        setRecipientType(next);
                        if (next === "one_time") {
                          setContactRowKey(null);
                          setContactId(null);
                          setLexofficeContactId(null);
                          setContactOriginallyEmpty(null);
                        } else {
                          setSaveNewContact(false);
                        }
                      }}
                      options={[
                        { value: "contact", label: "Kontakt aus Gwada / Lexware" },
                        { value: "one_time", label: "Neuer Kontakt" },
                      ]}
                      className={accountingFormSelectClassName}
                    />
                  </div>

                  {recipientType === "one_time" && !editRow ? (
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium">Kontakt speichern</p>
                          <p className="text-xs text-muted-foreground">
                            Empfänger zusätzlich im Kontaktbuch anlegen
                          </p>
                        </div>
                        <Switch
                          checked={saveNewContact}
                          onCheckedChange={setSaveNewContact}
                        />
                      </div>
                      {saveNewContact ? (
                        <p className="text-xs text-muted-foreground">
                          Mindestens E-Mail oder Telefon angeben — sonst kann der
                          Kontakt nicht gespeichert werden.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {recipientType === "contact" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Kontakt</Label>
                      <SearchableSelect
                        value={contactRowKey}
                        onValueChange={applyContactSelection}
                        options={contactOptions}
                        placeholder={
                          contacts.length
                            ? "Kontakt suchen …"
                            : "Keine Kontakte geladen"
                        }
                        className={accountingFormSelectClassName}
                      />
                      {!editRow &&
                      contactOriginallyEmpty &&
                      Object.values(contactOriginallyEmpty).some(Boolean) ? (
                        <p className="text-xs text-muted-foreground">
                          Fehlende Angaben können hier ergänzt werden — beim
                          Anlegen werden sie im Kontakt gespeichert.
                        </p>
                      ) : null}
                      {contactRowKey ? (
                        <AccountingContactRecipientFields
                          recipient={recipient}
                          originallyEmpty={
                            contactOriginallyEmpty ??
                            (selectedContact
                              ? originallyEmptyContactFields(selectedContact)
                              : originallyEmptyFromRecipientSnapshot(recipient))
                          }
                          onRecipientChange={(patch) =>
                            setRecipient((r) => ({ ...r, ...patch }))
                          }
                        />
                      ) : null}
                    </div>
                  ) : (
                    <AccountingContactRecipientFields
                      recipient={recipient}
                      originallyEmpty={ALL_CONTACT_RECIPIENT_FIELDS_EDITABLE}
                      onRecipientChange={(patch) =>
                        setRecipient((r) => ({ ...r, ...patch }))
                      }
                    />
                  )}
                </div>
              </AccountingFormSection>

              <AccountingFormSection title="Konditionen">
                <div className={accountingFormGridClassName}>
                  <div
                    className={
                      voucherDateKind === "period"
                        ? "space-y-2 sm:col-span-2"
                        : "space-y-2"
                    }
                  >
                    <SearchableSelect
                      value={voucherDateKind}
                      onValueChange={(v) => {
                        const next = v as AccountingVoucherDateKind;
                        setVoucherDateKind(next);
                        if (next === "period") {
                          setVoucherPeriodStart((prev) => prev ?? voucherDate);
                          setVoucherPeriodEnd((prev) => prev ?? voucherDate);
                        }
                      }}
                      options={voucherDateKindSelectOptions}
                      className={accountingFormSelectClassName}
                      aria-label={
                        documentKind === "invoice"
                          ? "Rechnungsdatum oder Rechnungszeitraum"
                          : "Angebotsdatum oder Angebotszeitraum"
                      }
                    />
                    {voucherDateKind === "date" ? (
                      <DatePickerField
                        fullWidth
                        className={accountingFormControlClassName}
                        value={voucherDate}
                        onChange={(v) => setVoucherDate(v ?? todayYmd())}
                      />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Von
                          </Label>
                          <DatePickerField
                            fullWidth
                            className={accountingFormControlClassName}
                            value={voucherPeriodStart}
                            onChange={setVoucherPeriodStart}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Bis
                          </Label>
                          <DatePickerField
                            fullWidth
                            className={accountingFormControlClassName}
                            value={voucherPeriodEnd}
                            onChange={setVoucherPeriodEnd}
                            minYmd={voucherPeriodStart ?? undefined}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <DatePickerField
                    fullWidth
                    className={accountingFormControlClassName}
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder={secondaryDateLabel}
                  />
                  <DatePickerField
                    fullWidth
                    className={accountingFormControlClassName}
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    placeholder="Lieferdatum"
                  />
                  <SearchableSelect
                    value={taxMode}
                    onValueChange={(v) => setTaxMode(v as AccountingTaxMode)}
                    options={TAX_MODE_OPTIONS}
                    className={accountingFormSelectClassName}
                    placeholder="Preisart"
                    searchPlaceholder="Preisart"
                    aria-label="Preisart"
                  />
                  <SearchableSelect
                    value={currency}
                    onValueChange={setCurrency}
                    options={currencyOptions}
                    className={accountingFormSelectClassName}
                    placeholder="Währung"
                    searchPlaceholder="Währung suchen …"
                    aria-label="Währung"
                  />
                  {editRow ? (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <SearchableSelect
                        value={status}
                        onValueChange={(v) =>
                          setStatus(
                            v as AccountingInvoiceStatus | AccountingQuotationStatus,
                          )
                        }
                        options={statusOptions}
                        className={accountingFormSelectClassName}
                      />
                    </div>
                  ) : null}
                </div>
              </AccountingFormSection>

              {!editRow && lexofficeConnected ? (
                <AccountingFormSection title="Lexware">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          Über Lexware erstellen
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kein separates Gwada-Dokument — nur Spiegel in der
                          Liste.
                        </p>
                      </div>
                      <Switch
                        checked={syncToLexoffice}
                        onCheckedChange={setSyncToLexoffice}
                      />
                    </div>
                    {syncToLexoffice ? (
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm">Als offen fertigstellen</Label>
                        <Switch
                          checked={finalizeOnCreate}
                          onCheckedChange={setFinalizeOnCreate}
                        />
                      </div>
                    ) : null}
                  </div>
                </AccountingFormSection>
              ) : null}

              {!editRow ? (
                <AccountingFormSection title="Versand">
                  <AccountingSendSection
                    sendEnabled={sendOnSave}
                    onSendEnabledChange={setSendOnSave}
                    sendEmail={sendEmail}
                    onSendEmailChange={setSendEmail}
                    sendWhatsapp={sendWhatsapp}
                    onSendWhatsappChange={setSendWhatsapp}
                    recipientEmail={recipient.email}
                    recipientPhone={recipient.phone}
                    whatsappConnected={whatsappConnected}
                    disabled={saving}
                  />
                </AccountingFormSection>
              ) : null}

              <AccountingFormSection title="Positionen">
                <AccountingLineItemsEditor
                  items={lineItems}
                  taxMode={taxMode}
                  currency={currency}
                  units={units}
                  taxRates={taxRates}
                  articles={articles}
                  onChange={setLineItems}
                />
                <div className="flex justify-end border-t border-border/40 pt-3 text-sm">
                  <span className="text-muted-foreground">Gesamt:&nbsp;</span>
                  <span className="font-semibold tabular-nums">
                    {new Intl.NumberFormat("de-DE", {
                      style: "currency",
                      currency,
                    }).format(totals.totalGross)}
                  </span>
                </div>
              </AccountingFormSection>
            </div>
          )}
        </div>

        <DrawerFormFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Schließen"
          showSubmit={!readOnlyLexoffice}
          submitType="button"
          submitLabel={editRow ? "Speichern" : "Anlegen"}
          submitPending={saving}
          onSubmit={() => void handleSave()}
        />
      </DrawerContent>
    </Drawer>
  );
}
