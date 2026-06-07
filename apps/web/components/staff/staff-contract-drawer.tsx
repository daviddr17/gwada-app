"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { cn } from "@/lib/utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  deleteStaffContract,
  fetchStaffContractLogEntries,
  upsertStaffContract,
} from "@/lib/supabase/staff-db";
import {
  buildStaffContractChanges,
  formatStaffContractLogActorLabel,
  formatStaffContractLogSummary,
  insertStaffContractLogEntry,
} from "@/lib/staff/staff-contract-log";
import {
  findOverlappingStaffContract,
  formatStaffContractDateDe,
  formatStaffContractEndDe,
  formatStaffContractPeriodDe,
} from "@/lib/staff/staff-contract-period";
import type {
  RestaurantStaffContractLogEntry,
  RestaurantStaffContractRow,
  StaffContractPayType,
  StaffEmploymentType,
} from "@/lib/types/staff";
import {
  STAFF_CONTRACT_PAY_ITEMS,
  STAFF_CONTRACT_PAY_LABELS,
  STAFF_CONTRACT_PAY_TYPES,
  STAFF_EMPLOYMENT_ITEMS,
  STAFF_EMPLOYMENT_LABELS,
  STAFF_EMPLOYMENT_TYPES,
} from "@/lib/types/staff";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type StaffContractDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  contract: RestaurantStaffContractRow | null;
  existingContracts: readonly RestaurantStaffContractRow[];
  onSaved: () => void;
  onDeleted: () => void;
};

export function StaffContractDrawer({
  open,
  onOpenChange,
  restaurantId,
  staffId,
  contract,
  existingContracts,
  onSaved,
  onDeleted,
}: StaffContractDrawerProps) {
  const editId = contract?.id ?? null;
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [payType, setPayType] = useState<StaffContractPayType>("hourly");
  const [hourly, setHourly] = useState("");
  const [fixed, setFixed] = useState("");
  const [employmentType, setEmploymentType] = useState<
    StaffEmploymentType | ""
  >("");
  const [vacationDays, setVacationDays] = useState("");
  const [note, setNote] = useState("");
  const [logEntries, setLogEntries] = useState<RestaurantStaffContractLogEntry[]>(
    [],
  );
  const [logLoading, setLogLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (contract) {
      setValidFrom(contract.valid_from);
      setValidTo(contract.valid_to ?? "");
      setPayType(contract.pay_type);
      setHourly(
        contract.hourly_rate_cents != null
          ? String(contract.hourly_rate_cents / 100)
          : "",
      );
      setFixed(
        contract.fixed_salary_cents != null
          ? String(contract.fixed_salary_cents / 100)
          : "",
      );
      setEmploymentType(contract.employment_type ?? "");
      setVacationDays(
        contract.vacation_days_per_year != null
          ? String(contract.vacation_days_per_year)
          : "",
      );
      setNote(contract.note ?? "");
    } else {
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidTo("");
      setPayType("hourly");
      setHourly("");
      setFixed("");
      setEmploymentType("");
      setVacationDays("");
      setNote("");
    }
  }, [open, contract]);

  const reloadLog = useCallback(async () => {
    if (!editId) {
      setLogEntries([]);
      return;
    }
    setLogLoading(true);
    const { data, error } = await fetchStaffContractLogEntries(
      restaurantId,
      editId,
    );
    setLogLoading(false);
    if (error) setLogEntries([]);
    else setLogEntries(data);
  }, [restaurantId, editId]);

  useEffect(() => {
    if (!open || !editId) return;
    void reloadLog();
  }, [open, editId, reloadLog]);

  const save = async () => {
    if (!validFrom) {
      toast.error("Bitte „Gültig von“ angeben.");
      return;
    }
    if (validTo && validTo < validFrom) {
      toast.error("„Gültig bis“ darf nicht vor „Gültig von“ liegen.");
      return;
    }

    const vacationTrim = vacationDays.trim();
    let vacationDaysPerYear: number | null = null;
    if (vacationTrim) {
      const n = Number.parseInt(vacationTrim, 10);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Urlaubstage müssen eine gültige Zahl ≥ 0 sein.");
        return;
      }
      vacationDaysPerYear = n;
    }

    let hourlyCents: number | null = null;
    let fixedCents: number | null = null;

    if (payType === "hourly") {
      const raw = hourly.trim();
      if (!raw) {
        toast.error("Bitte einen Stundenlohn angeben.");
        return;
      }
      const parsed = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Bitte einen gültigen Stundenlohn größer als 0 angeben.");
        return;
      }
      hourlyCents = Math.round(parsed * 100);
    } else {
      const raw = fixed.trim();
      if (!raw) {
        toast.error("Bitte einen Festlohn angeben.");
        return;
      }
      const parsed = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Bitte einen gültigen Festlohn größer als 0 angeben.");
        return;
      }
      fixedCents = Math.round(parsed * 100);
    }

    const payload = {
      valid_from: validFrom,
      valid_to: validTo || null,
      pay_type: payType,
      hourly_rate_cents: hourlyCents,
      fixed_salary_cents: fixedCents,
      currency: "EUR" as const,
      note: note.trim() || null,
      employment_type: employmentType || null,
      vacation_days_per_year: vacationDaysPerYear,
    };

    const overlap = findOverlappingStaffContract(
      existingContracts,
      payload.valid_from,
      payload.valid_to,
      editId ?? undefined,
    );
    if (overlap) {
      toast.error(
        `Der Zeitraum überschneidet sich mit einem bestehenden Vertrag (${formatStaffContractPeriodDe(overlap.valid_from, overlap.valid_to)}).`,
      );
      return;
    }

    setPending(true);
    const res = await upsertStaffContract(restaurantId, staffId, {
      id: editId ?? undefined,
      ...payload,
    });
    if (!res.ok) {
      setPending(false);
      const hint =
        /employment_type|vacation_days|contract_log/i.test(res.error)
          ? " Datenbank-Migration fehlt vermutlich — bitte „npx supabase db push“ ausführen."
          : "";
      toast.error(`Vertrag konnte nicht gespeichert werden: ${res.error}${hint}`);
      return;
    }

    const changes = buildStaffContractChanges(contract, payload);
    await insertStaffContractLogEntry(
      restaurantId,
      res.id,
      contract ? "updated" : "created",
      changes,
    );

    setPending(false);
    toast.success("Vertrag gespeichert");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-5 pt-2 pb-0 text-left">
          <DrawerTitle>
            {editId ? "Vertrag bearbeiten" : "Neuer Vertrag"}
          </DrawerTitle>
        </DrawerHeader>
        <div
          className={cn(staffDrawerScrollClassName, "space-y-4 px-5 pb-2")}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Gültig von</Label>
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className={staffDrawerFieldClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <Input
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className={staffDrawerFieldClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Art des Beschäftigungsverhältnisses</Label>
            <Select
              value={employmentType || ""}
              items={STAFF_EMPLOYMENT_ITEMS}
              onValueChange={(v) => {
                if (typeof v === "string") {
                  setEmploymentType(v as StaffEmploymentType);
                }
              }}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
              >
                <SelectValue placeholder="Bitte wählen">
                  {employmentType
                    ? STAFF_EMPLOYMENT_LABELS[employmentType]
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STAFF_EMPLOYMENT_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {STAFF_EMPLOYMENT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vergütung</Label>
            <Select
              value={payType}
              items={STAFF_CONTRACT_PAY_ITEMS}
              onValueChange={(v) => {
                if (typeof v === "string") {
                  setPayType(v as StaffContractPayType);
                }
              }}
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
              >
                <SelectValue placeholder="Vergütung wählen">
                  {STAFF_CONTRACT_PAY_LABELS[payType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STAFF_CONTRACT_PAY_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {STAFF_CONTRACT_PAY_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {payType === "hourly" ? (
            <div className="space-y-2">
              <Label>Stundenlohn (€)</Label>
              <Input
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
                inputMode="decimal"
                className={staffDrawerFieldClassName}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Festlohn pro Monat (€)</Label>
              <Input
                value={fixed}
                onChange={(e) => setFixed(e.target.value)}
                inputMode="decimal"
                className={staffDrawerFieldClassName}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Urlaubstage pro Jahr</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={vacationDays}
              onChange={(e) => setVacationDays(e.target.value)}
              placeholder="z. B. 30"
              className={staffDrawerFieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label>Notiz</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Interne Notiz zum Vertrag …"
              rows={3}
              className={staffDrawerFieldClassName}
            />
          </div>

          {editId ? (
            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-base font-semibold">Protokoll</Label>
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
                        {entry.action === "created"
                          ? "Angelegt"
                          : "Geändert"}
                        {" · "}
                        <span className="font-normal text-muted-foreground">
                          {whenFmt.format(new Date(entry.created_at))}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatStaffContractLogActorLabel(entry.details)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {entry.details.summary ??
                          formatStaffContractLogSummary(
                            entry.action,
                            entry.details.changes ?? [],
                          )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/50 px-5 pt-4 pb-6">
          <Button
            type="button"
            className="w-full rounded-xl"
            disabled={pending}
            onClick={() => void save()}
          >
            {pending ? "Speichern …" : "Speichern"}
          </Button>
          {editId ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Löschen
            </Button>
          ) : null}
        </div>
      </DrawerContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Vertrag löschen?"
        description={
          contract
            ? `Start ${formatStaffContractDateDe(contract.valid_from)}, Ende ${formatStaffContractEndDe(contract.valid_to)} — dieser Vertrag wird dauerhaft entfernt.`
            : "Dieser Vertrag wird dauerhaft entfernt."
        }
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          if (!editId) return;
          const ok = await deleteStaffContract(editId);
          if (!ok) {
            toast.error("Vertrag konnte nicht gelöscht werden.");
            throw new Error("delete failed");
          }
          toast.success("Vertrag gelöscht");
          setConfirmDelete(false);
          onDeleted();
          onOpenChange(false);
        }}
      />
    </Drawer>
  );
}
