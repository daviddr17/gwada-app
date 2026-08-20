"use client";

import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import type { SuperadminSubscriptionRow } from "@/lib/supabase/platform-superadmin-db";
import { cn } from "@/lib/utils";

type Props = {
  row: SuperadminSubscriptionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function SuperadminSubscriptionEditDrawer({
  row,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [planId, setPlanId] = useState("free");
  const [interval, setInterval] = useState("month");
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [hasPos, setHasPos] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row || !open) return;
    setPlanId(row.plan_id || "free");
    setInterval(row.billing_interval || "month");
    setStatus(row.status === "legacy" ? "legacy" : row.status || "active");
    setSource(row.source || "manual");
    setNotes(row.notes ?? "");
    setHasPos(Boolean(row.has_pos));
  }, [row, open]);

  async function save() {
    if (!row) return;
    if (row.source === "stripe" && row.stripe_subscription_id) {
      toast.error(
        "Stripe-Abos bitte im Stripe-Dashboard ändern — hier nur manuell/legacy/complimentary.",
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/superadmin/billing/subscriptions/${encodeURIComponent(row.restaurant_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            interval,
            status,
            source,
            notes,
            hasPos,
            posInterval: interval,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      toast.success("Abo aktualisiert.");
      onSaved();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  const stripeLocked = Boolean(
    row?.source === "stripe" && row.stripe_subscription_id,
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>Abo bearbeiten</DrawerTitle>
          <DrawerDescription>
            {row?.restaurant_name ?? "Restaurant"} — manuell / Legacy /
            Complimentary. Stripe-live-Abos bleiben im Stripe-Dashboard.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-2">
          {stripeLocked ? (
            <p className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
              Dieses Abo kommt von Stripe und ist hier schreibgeschützt.
              Complimentary/Legacy nur ohne aktives Stripe-Subscription.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select
                value={planId}
                onValueChange={(v) => setPlanId(String(v ?? "free"))}
                disabled={stripeLocked}
              >
                <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Intervall</Label>
              <Select
                value={interval}
                onValueChange={(v) => setInterval(String(v ?? "month"))}
                disabled={stripeLocked}
              >
                <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monatlich</SelectItem>
                  <SelectItem value="year">Jährlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(String(v ?? "active"))}
                disabled={stripeLocked}
              >
                <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="legacy">Legacy</SelectItem>
                  <SelectItem value="canceled">Gekündigt</SelectItem>
                  <SelectItem value="past_due">Zahlungsverzug</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quelle</Label>
              <Select
                value={source}
                onValueChange={(v) => setSource(String(v ?? "manual"))}
                disabled={stripeLocked}
              >
                <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuell</SelectItem>
                  <SelectItem value="legacy">Legacy</SelectItem>
                  <SelectItem value="complimentary">Complimentary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">POS-Add-on</p>
              <p className="text-xs text-muted-foreground">
                Manuell / Pilot — noch nicht im Kunden-Checkout
              </p>
            </div>
            <Switch
              checked={hasPos}
              onCheckedChange={setHasPos}
              disabled={stripeLocked}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-notes">Notiz</Label>
            <Input
              id="sub-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. Partner-Deal, Pilot…"
              disabled={stripeLocked}
            />
          </div>
        </div>

        <DrawerFooter className="gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl sm:flex-1"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            size="lg"
            className={cn("sm:flex-1", brandActionButtonRoundedClassName)}
            disabled={saving || stripeLocked}
            onClick={() => void save()}
          >
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
