"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AccountingContactRecipientFields } from "@/components/accounting/accounting-contact-recipient-fields";
import { AccountingFormSection } from "@/components/accounting/accounting-form-section";
import { AccountingVoucherItemsEditor, createEmptyVoucherItem } from "@/components/accounting/accounting-voucher-items-editor";
import { Button } from "@/components/ui/button";
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
import { computeVoucherTotals } from "@/lib/accounting/compute-voucher-totals";
import { unifiedContactOptionLabel } from "@/lib/contacts/unified-contact-row";
import { useAccountingContacts } from "@/lib/hooks/use-accounting-contacts";
import {
  ACCOUNTING_VOUCHER_ALLOWED_LABEL,
  ACCOUNTING_VOUCHER_FILE_ACCEPT,
  validateAccountingVoucherFile,
} from "@/lib/accounting/validate-voucher-file";
import type {
  AccountingRecipientSnapshot,
  AccountingVoucherInput,
  AccountingVoucherItem,
  AccountingVoucherKind,
  AccountingVoucherRow,
  AccountingVoucherStatus,
} from "@/lib/types/accounting";
import {
  accountingFormControlClassName,
  accountingFormGridClassName,
  accountingFormSectionClassName,
  accountingFormSectionTitleClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: { value: AccountingVoucherKind; label: string }[] = [
  { value: "expense", label: "Ausgabe" },
  { value: "purchase", label: "Einkauf" },
  { value: "income", label: "Einnahme" },
  { value: "sales", label: "Verkauf" },
];

const STATUS_OPTIONS: { value: AccountingVoucherStatus; label: string }[] = [
  { value: "open", label: "Offen" },
  { value: "unchecked", label: "Ungeprüft" },
  { value: "draft", label: "Entwurf" },
  { value: "paid", label: "Bezahlt" },
  { value: "voided", label: "Storniert" },
];

type AccountingVoucherDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  editRow: AccountingVoucherRow | null;
  lexofficeConnected: boolean;
  onSaved: () => void;
  onCreate: (
    input: AccountingVoucherInput,
    file: File | null,
  ) => Promise<void>;
  onUpdate: (id: string, input: Partial<AccountingVoucherInput> & { status?: AccountingVoucherStatus }) => Promise<void>;
};

export function AccountingVoucherDrawer({
  open,
  onOpenChange,
  restaurantId,
  editRow,
  lexofficeConnected,
  onSaved,
  onCreate,
  onUpdate,
}: AccountingVoucherDrawerProps) {
  const isEdit = Boolean(editRow);
  const readOnly = editRow?.source === "lexoffice";
  const { contacts, reload: reloadContacts } = useAccountingContacts(restaurantId);

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
  const [status, setStatus] = useState<AccountingVoucherStatus>("open");
  const [items, setItems] = useState<AccountingVoucherItem[]>([
    createEmptyVoucherItem(),
  ]);
  const [syncToLexoffice, setSyncToLexoffice] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const applySelectedFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    const err = validateAccountingVoucherFile(next);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(next);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) applySelectedFile(dropped);
    },
    [applySelectedFile],
  );

  useEffect(() => {
    if (!open) return;
    setVoucherKind(editRow?.voucher_kind ?? "expense");
    setVoucherDate(editRow?.voucher_date ?? new Date().toISOString().slice(0, 10));
    setDueDate(editRow?.due_date ?? null);
    setVoucherNumber(editRow?.voucher_number ?? "");
    if (editRow?.contact_id) {
      setRecipientType("contact");
      setContactId(editRow.contact_id);
      setContactRowKey(editRow.contact_id);
      setLexofficeContactId(null);
      setRecipient({
        name: editRow.contact_name ?? "",
        countryCode: "DE",
      });
      setContactOriginallyEmpty(null);
    } else if (editRow?.contact_name) {
      setRecipientType("one_time");
      setContactId(null);
      setContactRowKey(null);
      setLexofficeContactId(null);
      setRecipient({ name: editRow.contact_name, countryCode: "DE" });
      setContactOriginallyEmpty(originallyEmptyFromRecipientSnapshot({
        name: editRow.contact_name,
        countryCode: "DE",
      }));
    } else {
      setRecipientType("contact");
      setContactId(null);
      setContactRowKey(null);
      setLexofficeContactId(null);
      setRecipient({ name: "", countryCode: "DE" });
      setContactOriginallyEmpty(null);
    }
    setRemark(editRow?.remark ?? "");
    setTaxMode(editRow?.tax_mode ?? "gross");
    setStatus(editRow?.status ?? "open");
    setItems(
      editRow?.voucher_items?.length
        ? editRow.voucher_items
        : [createEmptyVoucherItem()],
    );
    setSyncToLexoffice(false);
    setSaveNewContact(false);
    setFile(null);
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, [open, editRow]);

  useEffect(() => {
    if (!open || !editRow?.contact_id || contacts.length === 0) return;
    const match = contacts.find((c) => c.gwadaContactId === editRow.contact_id);
    if (!match) return;
    setContactRowKey(match.rowKey);
    setLexofficeContactId(match.lexofficeContactId);
    setRecipient(recipientFromUnifiedContact(match));
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
    syncToLexoffice: !isEdit && syncToLexoffice,
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
      <DrawerContent
        className={cn(
          "mx-auto flex h-[min(96dvh,calc(100dvh-0.5rem))] max-h-[min(96dvh,calc(100dvh-0.5rem))] min-h-0 w-full max-w-[95vw] flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:mt-2 data-[vaul-drawer-direction=bottom]:max-h-[min(96dvh,calc(100dvh-0.5rem))]",
        )}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{isEdit ? "Beleg bearbeiten" : "Neuer Beleg"}</DrawerTitle>
          <DrawerDescription>
            Beleg-Scan oder PDF oben hochladen, danach Beträge erfassen.
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 md:px-6">
            {!isEdit ? (
              <div className="space-y-2">
                <Label id="voucher-file-label">Belegupload</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCOUNTING_VOUCHER_FILE_ACCEPT}
                  className="sr-only"
                  aria-labelledby="voucher-file-label"
                  disabled={saving}
                  onChange={(e) => {
                    applySelectedFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  data-vaul-no-drag
                  aria-labelledby="voucher-file-label"
                  className={cn(
                    "relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
                    isDragOver
                      ? "border-accent bg-accent/10"
                      : "border-border/60 bg-muted/25 hover:border-border hover:bg-muted/40",
                    file && "py-6",
                    saving && "pointer-events-none opacity-60",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                      aria-label="Datei entfernen"
                      onClick={(e) => {
                        e.stopPropagation();
                        applySelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                  <Upload
                    className={cn(
                      "size-8 shrink-0",
                      isDragOver ? "text-accent" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  {file ? (
                    <>
                      <span className="max-w-full truncate px-6 text-sm font-medium">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Klicken oder andere Datei hierher ziehen
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium">
                        {isDragOver
                          ? "Datei loslassen …"
                          : "Beleg hierher ziehen oder auswählen"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ACCOUNTING_VOUCHER_ALLOWED_LABEL} (max. 50 MB)
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {readOnly ? (
              <p className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Lexware-Belege können nur in Lexware bearbeitet werden.
              </p>
            ) : null}

            <div className={accountingFormSectionClassName}>
              <p className={accountingFormSectionTitleClassName}>Stammdaten</p>
              <div className={accountingFormGridClassName}>
                <div className="space-y-2">
                  <Label>Art</Label>
                  <SearchableSelect
                    disabled={readOnly || saving}
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
                    onValueChange={(v) => setStatus(v as AccountingVoucherStatus)}
                    options={STATUS_OPTIONS}
                    className={accountingFormSelectClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Belegdatum</Label>
                  <DatePickerField
                    value={voucherDate}
                    onChange={(v) => setVoucherDate(v ?? new Date().toISOString().slice(0, 10))}
                    disabled={readOnly || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fällig am</Label>
                  <DatePickerField
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
            </div>

            {!readOnly ? (
              <AccountingFormSection title="Kontakt">
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
              </AccountingFormSection>
            ) : null}

            <div className={accountingFormSectionClassName}>
              <div className="flex items-center justify-between gap-3">
                <p className={accountingFormSectionTitleClassName}>Steuerpositionen</p>
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
            </div>

            <div className="space-y-2">
              <Label>Notiz</Label>
              <Input
                disabled={readOnly || saving}
                className={accountingFormControlClassName}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>

            {!isEdit && lexofficeConnected ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">In Lexware anlegen</p>
                  <p className="text-xs text-muted-foreground">
                    Beleg wird nur in Lexware erstellt — kein Doppel in Gwada.
                  </p>
                </div>
                <Switch
                  checked={syncToLexoffice}
                  onCheckedChange={setSyncToLexoffice}
                  disabled={saving}
                />
              </div>
            ) : null}
          </div>

          <DrawerFormFooter
            className="px-4 md:px-6"
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            submitPending={saving}
            submitDisabled={readOnly}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
