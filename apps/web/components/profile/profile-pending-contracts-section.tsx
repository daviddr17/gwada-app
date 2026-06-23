"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/ui/signature-pad";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  fetchPendingStaffContracts,
  submitStaffContractEmployeeSign,
  type PendingStaffContractListItem,
} from "@/lib/staff/staff-contract-digital-api";
import { cn } from "@/lib/utils";

type ProfilePendingContractsSectionProps = {
  restaurantId: string;
  staffGivenName?: string | null;
  staffFamilyName?: string | null;
  onSigned?: () => void;
};

export function ProfilePendingContractsSection({
  restaurantId,
  staffGivenName,
  staffFamilyName,
  onSigned,
}: ProfilePendingContractsSectionProps) {
  const [items, setItems] = useState<PendingStaffContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PendingStaffContractListItem | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchPendingStaffContracts({ restaurantId });
    setLoading(false);
    if (!result.ok) {
      setItems([]);
      return;
    }
    setItems(result.items);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openSign = (item: PendingStaffContractListItem) => {
    setActive(item);
    setEmployeeName(
      [staffGivenName, staffFamilyName].filter(Boolean).join(" ").trim(),
    );
    setSignature(null);
    setConsent(false);
  };

  const closeSign = () => {
    if (submitting) return;
    setActive(null);
  };

  const submit = async () => {
    if (!active) return;
    if (!employeeName.trim()) {
      toast.error("Bitte deinen Namen angeben.");
      return;
    }
    if (!signature) {
      toast.error("Bitte unterschreiben.");
      return;
    }
    if (!consent) {
      toast.error("Bitte die Einwilligung bestätigen.");
      return;
    }

    setSubmitting(true);
    const result = await submitStaffContractEmployeeSign({
      restaurantId,
      contractId: active.id,
      consentAccepted: true,
      signatureEmployee: {
        signer_name: employeeName.trim(),
        signature_data_url: signature,
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Vertrag unterschrieben — PDF steht unter Meine Dokumente bereit.");
    setActive(null);
    await reload();
    onSigned?.();
  };

  if (loading || items.length === 0) {
    return null;
  }

  const whenFmt = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-lg">Vertrag unterschreiben</CardTitle>
          <CardDescription>
            {items.length === 1
              ? "Ein Arbeitsvertrag wartet auf deine Unterschrift."
              : `${items.length} Arbeitsverträge warten auf deine Unterschrift.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  Vom Arbeitgeber unterschrieben
                  {item.employerSignedAt
                    ? ` · ${whenFmt.format(new Date(item.employerSignedAt))}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                className={cn("shrink-0 rounded-xl", brandActionButtonRoundedClassName)}
                onClick={() => openSign(item)}
              >
                <PenLine className="size-4" />
                Unterschreiben
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Drawer open={Boolean(active)} onOpenChange={(open) => !open && closeSign()}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>{active?.title ?? "Vertrag unterschreiben"}</DrawerTitle>
            <DrawerDescription>
              Mit deiner Unterschrift wird der Vertrag abgeschlossen und als PDF
              gespeichert.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-2">
            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Die elektronische Unterschrift ist keine qualifizierte elektronische
              Signatur (QES).
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Unterschriftsdatum wird beim Abschluss serverseitig gesetzt.
            </p>
            <SignaturePad
              value={signature}
              onChange={setSignature}
              disabled={submitting}
              aria-label="Deine Unterschrift"
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 p-4">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span className="text-sm leading-snug">
                Ich willige ein, diesen Arbeitsvertrag elektronisch zu
                unterschreiben. Mir ist bekannt, dass dies keine qualifizierte
                elektronische Signatur (QES) ist.
              </span>
            </label>
          </div>
          <DrawerFooter>
            <Button
              type="button"
              className={cn("h-11 w-full", brandActionButtonRoundedClassName)}
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Wird gespeichert …
                </>
              ) : (
                "Vertrag unterschreiben"
              )}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
