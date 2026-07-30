"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDeferredDrawerMount } from "@/lib/hooks/use-deferred-drawer-mount";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { toast } from "sonner";
import { AccountingContactRecipientFields } from "@/components/accounting/accounting-contact-recipient-fields";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { AccountingVoucherDocumentPanel } from "@/components/accounting/accounting-voucher-document-panel";
import { AccountingVoucherItemsEditor, createEmptyVoucherItem } from "@/components/accounting/accounting-voucher-items-editor";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  collectContactRecipientPatches,
  formatContactPatchToast,
  originallyEmptyContactFields,
  originallyEmptyFromRecipientSnapshot,
  recipientFromUnifiedContact,
  type ContactOriginallyEmptyFields,
} from "@/lib/accounting/accounting-contact-recipient";
import {
  isExternalAccountingSource,
  isReadOnlyAccountingDocument,
} from "@/lib/accounting/accounting-source";
import { ACCOUNTING_DEFAULT_COUNTRY_CODE } from "@/lib/accounting/accounting-locale";
import {
  createContactFromAccountingRecipient,
  patchContactFieldsFromAccounting,
} from "@/lib/accounting/accounting-contact-recipient-api";
import { accountingVoucherFileUrl } from "@/lib/accounting/accounting-api";
import {
  correctionRemarkDefault,
  isAccountingCorrectionVariant,
  negateVoucherItems,
} from "@/lib/accounting/accounting-corrections";
import { voucherHasAttachment, voucherPreviewMime } from "@/lib/accounting/voucher-display";
import { computeVoucherTotals } from "@/lib/accounting/compute-voucher-totals";
import { accountingStatusSelectOptions } from "@/lib/accounting/accounting-status-labels";
import { unifiedContactOptionLabel } from "@/lib/contacts/unified-contact-row";
import { useAccountingContacts } from "@/lib/hooks/use-accounting-contacts";
import type {
  AccountingDocumentStatusRow,
  AccountingRecipientSnapshot,
  AccountingVoucherInput,
  AccountingVoucherItem,
  AccountingVoucherKind,
  AccountingVoucherRow,
} from "@/lib/types/accounting";
import {
  accountingFormControlClassName,
  accountingFormGridClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";
import { drawerFormSectionTitleClassName } from "@/lib/ui/drawer-form-section";
import {
  accountingVoucherDrawerContentClassName,
} from "@/lib/ui/accounting-drawer-layout";
import { cn } from "@/lib/utils";
import { DatePickerField } from "@/components/ui/date-picker";

const KIND_OPTIONS: { value: AccountingVoucherKind; label: string }[] = [
  { value: "expense", label: "Ausgabe" },
  { value: "purchase", label: "Einkauf" },
  { value: "income", label: "Einnahme" },
  { value: "sales", label: "Verkauf" },
];

type AccountingVoucherDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  editRow: AccountingVoucherRow | null;
  correctionOf?: AccountingVoucherRow | null;
  statuses: AccountingDocumentStatusRow[];
  externalConnectorConnected: boolean;
  lexofficeConnected?: boolean;
  onSaved: () => void;
  onCreate: (
    input: AccountingVoucherInput,
    file: File | null,
  ) => Promise<void>;
  onUpdate: (
    id: string,
    input: Partial<AccountingVoucherInput> & { status?: string },
  ) => Promise<void>;
  /** Vorausgewählte Beleg-Datei (z. B. per Drop auf die Seite). */
  initialFile?: File | null;
};

export function AccountingVoucherDrawer({
  open,
  onOpenChange,
  restaurantId,
  editRow,
  correctionOf = null,
  statuses,
  externalConnectorConnected,
  lexofficeConnected,
  onSaved,
  onCreate,
  onUpdate,
  initialFile = null,
}: AccountingVoucherDrawerProps) {
  const isEdit = Boolean(editRow);
  const connectorConnected =
    externalConnectorConnected ?? lexofficeConnected ?? false;
  const readOnly =
    editRow != null && isReadOnlyAccountingDocument(editRow.source);
  const isCorrectionCreate = !editRow && Boolean(correctionOf);
  const forceExternalCorrection =
    isCorrectionCreate &&
    correctionOf != null &&
    isExternalAccountingSource(correctionOf.source) &&
    connectorConnected;
  const { contacts, reload: reloadContacts } = useAccountingContacts(restaurantId);
  const mountContent = useDeferredDrawerMount(open);

  const [voucherKind, setVoucherKind] = useState<AccountingVoucherKind>("expense");
  const [voucherDate, setVoucherDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [voucherNumber, setVoucherNumber] = useState("");
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
  const [contactOriginallyEmpty, setContactOriginallyEmpty] =
    useState<ContactOriginallyEmptyFields | null>(null);
  const [saveNewContact, setSaveNewContact] = useState(false);
  const [remark, setRemark] = useState("");
  const [taxMode, setTaxMode] = useState<"net" | "gross">("gross");
  const [status, setStatus] = useState<string>("open");
  const [items, setItems] = useState<AccountingVoucherItem[]>([
    createEmptyVoucherItem(),
  ]);
  const [syncToLexoffice, setSyncToLexoffice] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useDrawerFormSeed(
    open,
    editRow?.id ?? correctionOf?.id ?? `create:${initialFile?.name ?? ""}:${initialFile?.size ?? 0}`,
    () => {
    if (editRow) {
      setVoucherKind(editRow.voucher_kind);
      setVoucherDate(editRow.voucher_date);
      setDueDate(editRow.due_date ?? null);
      setVoucherNumber(editRow.voucher_number ?? "");
      if (editRow.contact_id) {
        setRecipientType("contact");
        setContactId(editRow.contact_id);
        setContactRowKey(editRow.contact_id);
        setLexofficeContactId(null);
        setRecipient({
          name: editRow.contact_name ?? "",
          countryCode: "DE",
        });
        setContactOriginallyEmpty(null);
      } else if (editRow.contact_name) {
        setRecipientType("one_time");
        setContactId(null);
        setContactRowKey(null);
        setLexofficeContactId(null);
        setRecipient({ name: editRow.contact_name, countryCode: "DE" });
        setContactOriginallyEmpty(
          originallyEmptyFromRecipientSnapshot({
            name: editRow.contact_name,
            countryCode: "DE",
          }),
        );
      } else {
        setRecipientType("contact");
        setContactId(null);
        setContactRowKey(null);
        setLexofficeContactId(null);
        setRecipient({ name: "", countryCode: "DE" });
        setContactOriginallyEmpty(null);
      }
      setRemark(editRow.remark ?? "");
      setTaxMode(editRow.tax_mode ?? "gross");
      setStatus(editRow.status ?? "open");
      setItems(
        editRow.voucher_items?.length
          ? editRow.voucher_items
          : [createEmptyVoucherItem()],
      );
      setSyncToLexoffice(false);
      setSaveNewContact(false);
      setFile(null);
      return;
    }
    if (correctionOf) {
      const src = correctionOf;
      setVoucherKind(src.voucher_kind);
      setVoucherDate(new Date().toISOString().slice(0, 10));
      setDueDate(src.due_date ?? null);
      setVoucherNumber("");
      if (src.contact_id) {
        setRecipientType("contact");
        setContactId(src.contact_id);
        setContactRowKey(src.contact_id);
        setLexofficeContactId(null);
        setRecipient({
          name: src.contact_name ?? "",
          countryCode: "DE",
        });
        setContactOriginallyEmpty(null);
      } else if (src.contact_name) {
        setRecipientType("one_time");
        setContactId(null);
        setContactRowKey(null);
        setLexofficeContactId(null);
        setRecipient({ name: src.contact_name, countryCode: "DE" });
        setContactOriginallyEmpty(
          originallyEmptyFromRecipientSnapshot({
            name: src.contact_name,
            countryCode: "DE",
          }),
        );
      } else {
        setRecipientType("contact");
        setContactId(null);
        setContactRowKey(null);
        setLexofficeContactId(null);
        setRecipient({ name: "", countryCode: "DE" });
        setContactOriginallyEmpty(null);
      }
      setRemark(correctionRemarkDefault(src.voucher_number));
      setTaxMode(src.tax_mode ?? "gross");
      setStatus("open");
      setItems(
        src.voucher_items?.length
          ? negateVoucherItems(src.voucher_items)
          : [createEmptyVoucherItem()],
      );
      setSyncToLexoffice(
        isExternalAccountingSource(src.source) && connectorConnected,
      );
      setSaveNewContact(false);
      setFile(null);
      return;
    }
    setVoucherKind("expense");
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setDueDate(null);
    setVoucherNumber("");
    setRecipientType("contact");
    setContactId(null);
    setContactRowKey(null);
    setLexofficeContactId(null);
    setRecipient({ name: "", countryCode: "DE" });
    setContactOriginallyEmpty(null);
    setRemark("");
    setTaxMode("gross");
    setStatus("open");
    setItems([createEmptyVoucherItem()]);
    setSyncToLexoffice(false);
    setSaveNewContact(false);
    setFile(initialFile ?? null);
  },
  );

  const contactEnrichedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      contactEnrichedForRef.current = null;
      return;
    }
    const enrichKey = editRow?.contact_id ?? "";
    if (!enrichKey || contacts.length === 0) return;
    if (contactEnrichedForRef.current === enrichKey) return;
    const match = contacts.find((c) => c.gwadaContactId === editRow?.contact_id);
    if (!match) return;
    contactEnrichedForRef.current = enrichKey;
    setContactRowKey(match.rowKey);
    setLexofficeContactId(match.lexofficeContactId);
    setRecipient(recipientFromUnifiedContact(match));
    setContactOriginallyEmpty(
      (prev) => prev ?? originallyEmptyContactFields(match),
    );
  }, [open, editRow?.contact_id, contacts]);

  const contactOptions = useMemo(
    () =>
      contacts.map((row) => ({
        value: row.rowKey,
        label: unifiedContactOptionLabel(row),
        leadingPlatforms: row.platforms,
      })),
    [contacts],
  );

  const statusOptions = useMemo(
    () => accountingStatusSelectOptions(statuses),
    [statuses],
  );

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

  const totals = useMemo(
    () => computeVoucherTotals(items, taxMode),
    [items, taxMode],
  );

  const hasExistingFile = Boolean(editRow && voucherHasAttachment(editRow));

  const showDocumentPanel = !isEdit || hasExistingFile || Boolean(file);

  const formSectionBleed = showDocumentPanel ? ("column" as const) : true;

  const documentPreviewUrl =
    editRow && hasExistingFile
      ? accountingVoucherFileUrl(restaurantId, editRow.id)
      : null;

  const buildVoucherInput = (
    effectiveContactId: string | null,
    effectiveLexofficeContactId: string | null,
  ): AccountingVoucherInput => ({
    voucherKind,
    voucherDate,
    dueDate,
    voucherNumber: voucherNumber.trim() || null,
    contactId: effectiveContactId,
    lexofficeContactId: effectiveLexofficeContactId,
    contactName: recipient.name.trim() || null,
    remark: remark.trim() || null,
    taxMode,
    status,
    voucherItems: items,
    syncToLexoffice: !isEdit && (syncToLexoffice || forceExternalCorrection),
    ...(isCorrectionCreate && correctionOf
      ? {
          documentVariant: "correction" as const,
          correctsId: correctionOf.id,
        }
      : {}),
  });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let effectiveContactId = contactId;
      let effectiveLexofficeContactId = lexofficeContactId;
      let contactPatchLabel: string | null = null;
      let createdContact = false;

      if (
        !isEdit &&
        recipientType === "one_time" &&
        saveNewContact &&
        recipient.name.trim()
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
        effectiveLexofficeContactId = null;
        createdContact = true;
        await reloadContacts();
      }

      if (
        !isEdit &&
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

      const input = buildVoucherInput(
        effectiveContactId,
        effectiveLexofficeContactId,
      );

      if (isEdit && editRow) {
        await onUpdate(editRow.id, input);
        toast.success("Beleg gespeichert.");
      } else {
        await onCreate(input, file);
        if (contactPatchLabel) {
          toast.success(`Beleg angelegt. Kontakt ergänzt: ${contactPatchLabel}.`);
        } else if (createdContact) {
          toast.success("Beleg angelegt. Kontakt gespeichert.");
        } else {
          toast.success("Beleg angelegt.");
        }
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={accountingVoucherDrawerContentClassName}>
        <DrawerHeader className={drawerFormHeaderClassName("4-6", "border-b border-border/50")}>
          <DrawerTitle>
            {isEdit
              ? isAccountingCorrectionVariant(editRow?.document_variant)
                ? "Korrektur bearbeiten"
                : "Beleg bearbeiten"
              : isCorrectionCreate
                ? "Korrektur anlegen"
                : "Neuer Beleg"}
          </DrawerTitle>
          <DrawerDescription>
            {readOnly
              ? "Lexware-Beleg — Bearbeitung nur in Lexware."
              : showDocumentPanel
                ? "Beleg links, Erfassung rechts — auf schmalen Screens untereinander."
                : "Stammdaten, Kontakt und Steuerpositionen erfassen."}
          </DrawerDescription>
        </DrawerHeader>

        {mountContent ? (
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div
            className={cn(
              drawerScrollAreaClassName("4-6"),
              showDocumentPanel &&
                "lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden",
            )}
          >
            <div
              className={cn(
                "space-y-4",
                showDocumentPanel &&
                  "lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,42%)_minmax(0,1fr)] lg:items-stretch lg:gap-6 lg:space-y-0 lg:overflow-hidden",
              )}
            >
              {showDocumentPanel ? (
                <div className="min-h-0 overflow-y-auto lg:pr-1">
                  <AccountingVoucherDocumentPanel
                    mode={isEdit && hasExistingFile && !file ? "preview" : "upload"}
                    file={file}
                    onFileChange={!isEdit ? setFile : undefined}
                    previewUrl={documentPreviewUrl}
                    previewMime={voucherPreviewMime(editRow?.mime_type)}
                    fileName={editRow?.file_name}
                    disabled={readOnly || saving || isEdit}
                    label={isEdit ? "Beleg-Anhang" : "Belegupload"}
                  />
                </div>
              ) : null}

              <div className="min-h-0 space-y-0 overflow-y-auto lg:pr-1">
                {readOnly ? (
                  <DrawerFormSection
                    contentPadding="4-6"
                    bleed={formSectionBleed}
                    className="pt-3"
                  >
                    <p className="text-sm text-muted-foreground">
                      Lexware-Belege können nur in Lexware bearbeitet werden.
                    </p>
                  </DrawerFormSection>
                ) : null}

                <DrawerFormSection
                  title="Stammdaten"
                  contentPadding="4-6"
                  bleed={formSectionBleed}
                >
                  <div className={accountingFormGridClassName}>
                    <div className="space-y-2">
                      <Label>Art</Label>
                      <SearchableSelect
                        disabled={readOnly || saving || isCorrectionCreate}
                        value={voucherKind}
                        onValueChange={(v) => setVoucherKind(v as AccountingVoucherKind)}
                        options={KIND_OPTIONS}
                        className={accountingFormSelectClassName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <SearchableSelect
                        disabled={readOnly || saving}
                        value={status}
                        onValueChange={setStatus}
                        options={statusOptions}
                        className={accountingFormSelectClassName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Belegdatum</Label>
                      <DatePickerField
                        fullWidth
                        className={accountingFormControlClassName}
                        value={voucherDate}
                        onChange={(v) => setVoucherDate(v ?? new Date().toISOString().slice(0, 10))}
                        disabled={readOnly || saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fällig am</Label>
                      <DatePickerField
                        fullWidth
                        className={accountingFormControlClassName}
                        value={dueDate}
                        onChange={setDueDate}
                        disabled={readOnly || saving}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Belegnummer</Label>
                      <Input
                        disabled={readOnly || saving}
                        className={accountingFormControlClassName}
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </DrawerFormSection>

                {!readOnly ? (
                  <DrawerFormSection
                    title="Kontakt"
                    contentPadding="4-6"
                    bleed={formSectionBleed}
                  >
                    <div className={accountingFormGridClassName}>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Kontaktart</Label>
                        <SearchableSelect
                          disabled={saving}
                          value={recipientType}
                          onValueChange={(v) => {
                            const next = v as "contact" | "one_time";
                            setRecipientType(next);
                            if (next === "one_time") {
                              setContactRowKey(null);
                              setContactId(null);
                              setLexofficeContactId(null);
                              setContactOriginallyEmpty(null);
                              setRecipient({ name: "", countryCode: "DE" });
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

                      {recipientType === "one_time" && !isEdit ? (
                        <div className="space-y-2 sm:col-span-2">
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card px-3 py-2.5">
                            <div>
                              <p className="text-sm font-medium">Kontakt speichern</p>
                              <p className="text-xs text-muted-foreground">
                                Lieferant/Kunde zusätzlich im Kontaktbuch anlegen
                              </p>
                            </div>
                            <Switch
                              checked={saveNewContact}
                              onCheckedChange={setSaveNewContact}
                              disabled={saving}
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
                            disabled={saving}
                          />
                          {!isEdit &&
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
                          originallyEmpty={originallyEmptyFromRecipientSnapshot(
                            recipient,
                          )}
                          onRecipientChange={(patch) =>
                            setRecipient((r) => ({ ...r, ...patch }))
                          }
                        />
                      )}
                    </div>
                  </DrawerFormSection>
                ) : null}

                <DrawerFormSection contentPadding="4-6" bleed={formSectionBleed}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={drawerFormSectionTitleClassName}>
                      Steuerpositionen
                    </h3>
                    <SearchableSelect
                      disabled={readOnly || saving}
                      value={taxMode}
                      onValueChange={(v) => setTaxMode(v as "net" | "gross")}
                      options={[
                        { value: "gross", label: "Brutto" },
                        { value: "net", label: "Netto" },
                      ]}
                      className={cn(accountingFormSelectClassName, "h-9 w-28")}
                    />
                  </div>
                  <AccountingVoucherItemsEditor
                    items={items}
                    taxMode={taxMode}
                    disabled={readOnly || saving}
                    onChange={setItems}
                  />
                  <p className="text-right text-sm tabular-nums text-muted-foreground">
                    Summe brutto:{" "}
                    <span className="font-medium text-foreground">
                      {totals.totalGross.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                  </p>
                </DrawerFormSection>

                <DrawerFormSection
                  title="Notiz"
                  contentPadding="4-6"
                  bleed={formSectionBleed}
                >
                  <Input
                    disabled={readOnly || saving}
                    className={accountingFormControlClassName}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </DrawerFormSection>

                {!isEdit && connectorConnected ? (
                  forceExternalCorrection ? (
                    <p className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
                      Korrektur wird als Gutschrift in Lexware angelegt.
                    </p>
                  ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">In Lexware anlegen</p>
                      <p className="text-xs text-muted-foreground">
                        Beleg wird nur in Lexware erstellt — kein Doppel in Gwada, danach Abruf aus Lexware.
                      </p>
                    </div>
                    <Switch
                      checked={syncToLexoffice}
                      onCheckedChange={setSyncToLexoffice}
                      disabled={saving}
                    />
                  </div>
                  )
                ) : null}

                {isCorrectionCreate &&
                correctionOf &&
                !correctionOf.voucher_items?.length ? (
                  <p className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
                    Steuerpositionen der Ursprungsbeleg sind nicht lokal
                    hinterlegt — trage die Korrekturbeträge manuell ein
                    (negative Werte).
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DrawerFormFooter
            className="shrink-0 border-t border-border/50 px-4 md:px-6"
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            submitPending={saving}
            submitDisabled={readOnly}
          />
        </form>
        ) : (
          <div
            className={drawerScrollAreaClassName("4-6")}
            aria-hidden
            aria-busy
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
