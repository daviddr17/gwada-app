"use client";

import { useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { AccountingContactRecipientFields } from "@/components/accounting/accounting-contact-recipient-fields";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { AccountingLineItemsEditor } from "@/components/accounting/accounting-line-items-editor";
import { AccountingSalesDocumentLivePreview } from "@/components/accounting/accounting-sales-document-live-preview";
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
import { Input } from "@/components/ui/input";
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
import {
  correctionIntroductionText,
  correctionRemarkDefault,
  isAccountingCorrectionVariant,
  negateLineItems,
} from "@/lib/accounting/accounting-corrections";
import { fetchAccountingNextDocumentNumber, enrichAccountingInvoice } from "@/lib/accounting/accounting-api";
import {
  isExternalAccountingSource,
  isReadOnlyAccountingDocument,
} from "@/lib/accounting/accounting-source";
import { ACCOUNTING_DEFAULT_COUNTRY_CODE } from "@/lib/accounting/accounting-locale";
import { createEmptyLineItem } from "@/lib/accounting/default-catalog";
import { accountingStatusSelectOptions } from "@/lib/accounting/accounting-status-labels";
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
import { cn } from "@/lib/utils";
import type {
  AccountingArticleRow,
  AccountingDocumentStatusRow,
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingQuotationRow,
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
  correctionOf?: SalesDocumentRow | null;
  taxRates: AccountingTaxRateRow[];
  units: AccountingUnitRow[];
  articles: AccountingArticleRow[];
  statuses: AccountingDocumentStatusRow[];
  externalConnectorConnected: boolean;
  /** @deprecated externalConnectorConnected */
  lexofficeConnected?: boolean;
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
  correctionOf = null,
  taxRates,
  units,
  articles,
  statuses,
  externalConnectorConnected,
  lexofficeConnected,
  onSaved,
  onCreate,
  onUpdate,
}: AccountingSalesDocumentDrawerProps) {
  const { contacts, reload: reloadContacts } = useAccountingContacts(
    open ? restaurantId : null,
  );
  const connectorConnected =
    externalConnectorConnected ?? lexofficeConnected ?? false;
  const readOnlyExternal =
    editRow != null && isReadOnlyAccountingDocument(editRow.source);
  const isCorrectionCreate =
    !editRow && Boolean(correctionOf) && documentKind === "invoice";
  const forceExternalCorrection =
    isCorrectionCreate &&
    correctionOf != null &&
    isExternalAccountingSource(correctionOf.source) &&
    connectorConnected;
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
    countryCode: ACCOUNTING_DEFAULT_COUNTRY_CODE,
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
  const [status, setStatus] = useState<string>("open");
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
  const [nextVoucherNumber, setNextVoucherNumber] = useState<string | null>(
    null,
  );
  const [createStep, setCreateStep] = useState<"form" | "preview">("form");

  const showGwadaDocument = !readOnlyExternal && (!editRow || editRow.source === "gwada");
  const showGwadaNumbering = showGwadaDocument && (!editRow ? !syncToLexoffice : true);
  const usePreviewFlow = !editRow && showGwadaDocument && !syncToLexoffice;
  const onPreviewStep = usePreviewFlow && createStep === "preview";

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
    if (correctionOf && documentKind === "invoice") {
      const src = correctionOf as AccountingInvoiceRow;
      setRecipientType(src.recipient_type);
      setContactId(src.contact_id);
      setContactRowKey(src.contact_id ?? null);
      setLexofficeContactId(null);
      setRecipient(src.recipient_snapshot ?? { name: "" });
      setVoucherDate(todayYmd());
      setVoucherDateKind("date");
      setVoucherPeriodStart(null);
      setVoucherPeriodEnd(null);
      setDueDate(src.due_date ?? null);
      setDeliveryDate(src.delivery_date ?? null);
      setTaxMode(src.tax_mode);
      setCurrency(src.currency);
      setLineItems(
        src.line_items?.length
          ? negateLineItems(src.line_items)
          : [createEmptyLineItem({ taxRatePercent: defaultTax })],
      );
      setStatus("open");
      setSyncToLexoffice(
        isExternalAccountingSource(src.source) && connectorConnected,
      );
      setFinalizeOnCreate(false);
      setSentEditAck(false);
      setContactOriginallyEmpty(null);
      setSaveNewContact(false);
      setSendOnSave(false);
      setSendEmail(false);
      setSendWhatsapp(false);
      setCreateStep("form");
      return;
    }
    setRecipientType("contact");
    setContactRowKey(null);
    setContactId(null);
    setLexofficeContactId(null);
    setContactOriginallyEmpty(null);
    setRecipient({ name: "", countryCode: ACCOUNTING_DEFAULT_COUNTRY_CODE });
    setVoucherDate(todayYmd());
    setVoucherDateKind("date");
    setVoucherPeriodStart(null);
    setVoucherPeriodEnd(null);
    setDueDate(null);
    setDeliveryDate(null);
    setTaxMode("net");
    setCurrency("EUR");
    setLineItems([createEmptyLineItem({ taxRatePercent: defaultTax })]);
    setStatus(
      statuses.find((s) => s.code === "draft" && !s.archived)?.code ??
        statuses.find((s) => !s.archived)?.code ??
        "open",
    );
    setSyncToLexoffice(false);
    setFinalizeOnCreate(false);
    setSentEditAck(false);
    setSaveNewContact(false);
    setSendOnSave(false);
    setSendEmail(false);
    setSendWhatsapp(false);
    setCreateStep("form");
  }, [
    open,
    editRow,
    correctionOf,
    defaultTax,
    documentKind,
    statuses,
    connectorConnected,
  ]);

  useEffect(() => {
    if (!open || !correctionOf || documentKind !== "invoice") return;
    const src = correctionOf as AccountingInvoiceRow;
    if (!isExternalAccountingSource(src.source) || src.line_items?.length) {
      return;
    }

    let cancelled = false;
    void enrichAccountingInvoice(restaurantId, src.id)
      .then((enriched) => {
        if (cancelled || !enriched.line_items?.length) return;
        setLineItems(negateLineItems(enriched.line_items));
        if (enriched.recipient_snapshot) {
          setRecipient(enriched.recipient_snapshot);
        }
        setTaxMode(enriched.tax_mode);
        setCurrency(enriched.currency);
      })
      .catch(() => {
        /* Hinweis im Formular bleibt sichtbar */
      });

    return () => {
      cancelled = true;
    };
  }, [open, correctionOf, documentKind, restaurantId]);

  useEffect(() => {
    if (!open || editRow || syncToLexoffice || readOnlyExternal) {
      setNextVoucherNumber(null);
      return;
    }

    const numberingKind = isCorrectionCreate ? "invoice_correction" : documentKind;

    let cancelled = false;
    void fetchAccountingNextDocumentNumber(
      restaurantId,
      numberingKind,
      voucherDate,
    )
      .then((number) => {
        if (!cancelled) setNextVoucherNumber(number);
      })
      .catch(() => {
        if (!cancelled) setNextVoucherNumber(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    editRow,
    isCorrectionCreate,
    syncToLexoffice,
    readOnlyExternal,
    restaurantId,
    documentKind,
    voucherDate,
  ]);

  useEffect(() => {
    if (syncToLexoffice) setCreateStep("form");
  }, [syncToLexoffice]);

  const totals = useMemo(
    () => computeDocumentTotals(lineItems, taxMode, currency),
    [lineItems, taxMode, currency],
  );

  const wasSent = Boolean(editRow?.sent_at);
  const needsSentAck = wasSent && !sentEditAck && !readOnlyExternal;
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
      syncToLexoffice: !editRow && (syncToLexoffice || forceExternalCorrection),
      finalizeOnCreate: !editRow && finalizeOnCreate,
      sendOnSave: !editRow && sendOnSave,
      sendEmail: sendOnSave && sendEmail,
      sendWhatsapp: sendOnSave && sendWhatsapp,
      status,
      ...(isCorrectionCreate && correctionOf
        ? {
            documentVariant: "correction" as const,
            correctsId: correctionOf.id,
            introduction: correctionIntroductionText(correctionOf.voucher_number),
            remark: correctionRemarkDefault(correctionOf.voucher_number),
          }
        : {}),
    };
  };

  const validateForm = (): boolean => {
    if (!recipient.name.trim()) {
      toast.error("Empfänger fehlt — Kontakt wählen oder Name eingeben.");
      return false;
    }
    if (lineItems.every((l) => l.type === "text" || !l.name.trim())) {
      toast.error("Mindestens eine Position mit Bezeichnung erforderlich.");
      return false;
    }
    if (voucherDateKind === "period") {
      if (!voucherPeriodStart || !voucherPeriodEnd) {
        toast.error(
          documentKind === "invoice"
            ? "Bitte Rechnungszeitraum von und bis angeben."
            : "Bitte Angebotszeitraum von und bis angeben.",
        );
        return false;
      }
      if (voucherPeriodStart > voucherPeriodEnd) {
        toast.error("Der Zeitraum-Start darf nicht nach dem Ende liegen.");
        return false;
      }
    }
    if (needsSentAck) {
      toast.error(
        "Bitte bestätigen Sie die Änderung an einem verschickten Dokument.",
      );
      return false;
    }
    return true;
  };

  const handleGoToPreview = () => {
    if (!validateForm()) return;
    setCreateStep("preview");
  };

  const handleSave = async () => {
    if (!validateForm()) return;
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

  const handleDrawerOpenChange = (next: boolean) => {
    if (!next) setCreateStep("form");
    onOpenChange(next);
  };

  const title =
    onPreviewStep
      ? documentKind === "invoice"
        ? isCorrectionCreate
          ? "Vorschau — Korrektur"
          : "Vorschau — Neue Rechnung"
        : "Vorschau — Neues Angebot"
      : documentKind === "invoice"
        ? editRow
          ? isAccountingCorrectionVariant(editRow.document_variant)
            ? "Korrektur bearbeiten"
            : "Rechnung bearbeiten"
          : isCorrectionCreate
            ? "Korrektur anlegen"
            : "Neue Rechnung"
        : editRow
          ? "Angebot bearbeiten"
          : "Neues Angebot";

  const statusOptions = useMemo(
    () => accountingStatusSelectOptions(statuses),
    [statuses],
  );

  const secondaryDateLabel =
    documentKind === "invoice" ? "Fällig am" : "Gültig bis";

  const numberLabel = isCorrectionCreate
    ? "Korrektur-Nummer"
    : documentKind === "invoice"
      ? "Rechnungsnummer"
      : "Angebotsnummer";

  const displayedVoucherNumber = editRow
    ? editRow.voucher_number ?? "—"
    : nextVoucherNumber ?? "…";

  const previewDraft = useMemo(() => {
    const storedVoucherDate = resolveStoredVoucherDate({
      voucherDateKind,
      voucherDate,
      voucherPeriodEnd,
    });

    return {
      voucherNumber: editRow
        ? editRow.voucher_number
        : nextVoucherNumber,
      recipient,
      voucherDate: storedVoucherDate,
      voucherDateKind,
      voucherPeriodStart:
        voucherDateKind === "period" ? voucherPeriodStart : null,
      voucherPeriodEnd: voucherDateKind === "period" ? voucherPeriodEnd : null,
      dueDate: documentKind === "invoice" ? dueDate : null,
      deliveryDate,
      expirationDate: documentKind === "quotation" ? dueDate : null,
      currency,
      taxMode,
      lineItems,
      status,
    };
  }, [
    editRow,
    nextVoucherNumber,
    recipient,
    voucherDateKind,
    voucherDate,
    voucherPeriodStart,
    voucherPeriodEnd,
    dueDate,
    deliveryDate,
    documentKind,
    currency,
    taxMode,
    lineItems,
    status,
  ]);

  return (
    <Drawer open={open} onOpenChange={handleDrawerOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("salesDocument")}>
        <DrawerHeader className="shrink-0 border-b border-border/50 pb-3 text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>
            {readOnlyExternal
              ? "Lexware-Dokument — Bearbeitung nur in Lexware."
              : onPreviewStep
                ? "PDF prüfen, optional versenden und dann anlegen."
                : "Empfänger, Konditionen und Positionen erfassen."}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(4)}>
          {readOnlyExternal ? (
            <DrawerFormSection contentPadding={4}>
              <p className="text-sm text-muted-foreground">
                Änderungen nur direkt in Lexware möglich. Nutzen Sie „In Lexware“
                in der Liste.
              </p>
            </DrawerFormSection>
          ) : onPreviewStep ? (
            <>
              <DrawerFormSection contentPadding={4} className="pt-1">
                <AccountingSalesDocumentLivePreview
                  restaurantId={restaurantId}
                  kind={documentKind}
                  enabled={open}
                  draft={previewDraft}
                  variant="step"
                />
              </DrawerFormSection>
              <DrawerFormSection contentPadding={4} title="Versand">
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
              </DrawerFormSection>
            </>
          ) : (
            <>
              {wasSent ? (
                <DrawerFormSection contentPadding={4}>
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
                </DrawerFormSection>
              ) : null}

              <DrawerFormSection contentPadding={4} title="Empfänger">
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
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Konditionen">
                <div className={accountingFormGridClassName}>
                  {showGwadaNumbering ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{numberLabel}</Label>
                      <Input
                        readOnly
                        disabled
                        value={displayedVoucherNumber}
                        className={accountingFormControlClassName}
                        aria-label={numberLabel}
                      />
                      {!editRow ? (
                        <p className="text-xs text-muted-foreground">
                          Wird beim Anlegen automatisch vergeben — getrennte
                          Nummernkreise für Rechnungen und Angebote.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
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
                        onValueChange={setStatus}
                        options={statusOptions}
                        className={accountingFormSelectClassName}
                      />
                    </div>
                  ) : null}
                </div>
              </DrawerFormSection>

              {!editRow && connectorConnected ? (
                <DrawerFormSection contentPadding={4} title="Lexware">
                  <div className="space-y-3">
                    {forceExternalCorrection ? (
                      <p className="text-sm text-muted-foreground">
                        Korrektur wird als Gutschrift in Lexware angelegt und
                        mit der Ursprungsrechnung verknüpft.
                      </p>
                    ) : (
                      <>
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
                      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3">
                        <Label className="text-sm">Status in Lexware</Label>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "min-w-[4.5rem] text-sm transition-colors",
                              !finalizeOnCreate
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            Entwurf
                          </span>
                          <Switch
                            checked={finalizeOnCreate}
                            onCheckedChange={setFinalizeOnCreate}
                            aria-label={
                              finalizeOnCreate
                                ? "Offen in Lexware"
                                : "Entwurf in Lexware"
                            }
                          />
                          <span
                            className={cn(
                              "min-w-[4.5rem] text-sm transition-colors",
                              finalizeOnCreate
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            Offen
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {finalizeOnCreate
                            ? `Vergibt eine Belegnummer — ${documentKind === "invoice" ? "Rechnung" : "Angebot"} ist sofort offen.`
                            : "Speichert als Entwurf — Fertigstellung später in Lexware."}
                        </p>
                      </div>
                    ) : null}
                      </>
                    )}
                  </div>
                </DrawerFormSection>
              ) : null}

              {isCorrectionCreate &&
              correctionOf &&
              !correctionOf.line_items?.length ? (
                <p className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
                  Positionen der Ursprungsrechnung sind nicht lokal hinterlegt —
                  trage die Korrekturbeträge manuell ein (negative Werte).
                </p>
              ) : null}

              {!editRow && !usePreviewFlow ? (
                <DrawerFormSection contentPadding={4} title="Versand">
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
                </DrawerFormSection>
              ) : null}

              <DrawerFormSection contentPadding={4} title="Positionen">
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
              </DrawerFormSection>
            </>
          )}
        </div>

        <DrawerFormFooter
          className="shrink-0 border-t border-border/50"
          onCancel={
            onPreviewStep
              ? () => setCreateStep("form")
              : () => handleDrawerOpenChange(false)
          }
          cancelLabel={onPreviewStep ? "Zurück" : "Schließen"}
          showSubmit={!readOnlyExternal}
          submitType="button"
          submitLabel={
            onPreviewStep
              ? "Anlegen"
              : editRow
                ? "Speichern"
                : usePreviewFlow
                  ? "Vorschau"
                  : "Anlegen"
          }
          submitPending={saving}
          onSubmit={
            onPreviewStep || editRow || !usePreviewFlow
              ? () => void handleSave()
              : () => handleGoToPreview()
          }
        />
      </DrawerContent>
    </Drawer>
  );
}
