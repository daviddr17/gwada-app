"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DatePickerField } from "@/components/ui/date-picker";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

type Draft = {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  paidAt: string | null;
  amountCents: number;
  tipCents: number;
  alreadyInvoiced: boolean;
  existingInvoiceId: string | null;
  existingInvoiceNumber: string | null;
  alreadyStornoed: boolean;
  existingCorrectionId: string | null;
  existingCorrectionNumber: string | null;
  existingInvoiceStatus: string | null;
  lineItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRatePercent: number;
    lineAmount: number;
  }>;
  suggestedRemark: string;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

type PosFormalInvoiceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  paymentId: string | null;
  onCreated?: (invoiceId: string) => void;
};

export function PosFormalInvoiceDrawer({
  open,
  onOpenChange,
  restaurantId,
  paymentId,
  onCreated,
}: PosFormalInvoiceDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stornoBusy, setStornoBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [personName, setPersonName] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [voucherDate, setVoucherDate] = useState("");

  useEffect(() => {
    if (!open || !paymentId || !restaurantId) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/pos/payments/${encodeURIComponent(paymentId)}/formal-invoice?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          draft?: Draft;
          error?: string;
        };
        if (!res.ok || !json.draft) {
          toast.error(
            json.error === "forbidden"
              ? "Keine Berechtigung für Rechnungen (Buchführung)."
              : json.error ?? "Entwurf laden fehlgeschlagen",
          );
          if (!cancelled) setDraft(null);
          return;
        }
        if (cancelled) return;
        setDraft(json.draft);
        setCompanyName("");
        setPersonName("");
        setStreet("");
        setZip("");
        setCity("");
        setEmail("");
        setPhone("");
        setVoucherDate(
          json.draft.paidAt?.slice(0, 10) ??
            new Date().toISOString().slice(0, 10),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, paymentId, restaurantId]);

  const stornoInvoice = async () => {
    if (!paymentId || !draft?.alreadyInvoiced || draft.alreadyStornoed) return;
    setStornoBusy(true);
    try {
      const res = await fetch(
        `/api/pos/payments/${encodeURIComponent(paymentId)}/formal-invoice/storno`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId }),
        },
      );
      const json = (await res.json()) as {
        storno?: {
          mode: string;
          invoiceNumber?: string | null;
          correctionNumber?: string | null;
        };
        error?: string;
      };
      if (!res.ok || !json.storno) {
        toast.error(json.error ?? "Rechnungsstorno fehlgeschlagen.");
        return;
      }
      if (json.storno.mode === "correction") {
        toast.success(
          json.storno.correctionNumber
            ? `Korrektur ${json.storno.correctionNumber} erstellt`
            : "Rechnungs-Korrektur erstellt",
        );
      } else {
        toast.success(
          json.storno.invoiceNumber
            ? `Rechnung ${json.storno.invoiceNumber} storniert`
            : "Formale Rechnung storniert",
        );
      }
      onCreated?.(draft.existingInvoiceId ?? paymentId);
      onOpenChange(false);
    } finally {
      setStornoBusy(false);
    }
  };

  const createInvoice = async () => {
    if (!paymentId || !draft) return;
    if (!companyName.trim() && !personName.trim()) {
      toast.error("Bitte Name oder Firmenname angeben.");
      return;
    }
    if (!street.trim() || !zip.trim() || !city.trim()) {
      toast.error("Straße, PLZ und Ort sind erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/pos/payments/${encodeURIComponent(paymentId)}/formal-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            companyName: companyName.trim() || null,
            personName: personName.trim() || null,
            street: street.trim(),
            zip: zip.trim(),
            city: city.trim(),
            countryCode: "DE",
            email: email.trim() || null,
            phone: phone.trim() || null,
            voucherDate: voucherDate || null,
          }),
        },
      );
      const json = (await res.json()) as {
        invoice?: { id: string; voucher_number?: string | null };
        error?: string;
      };
      if (!res.ok || !json.invoice) {
        toast.error(json.error ?? "Rechnung konnte nicht erstellt werden.");
        return;
      }
      toast.success(
        json.invoice.voucher_number
          ? `Rechnung ${json.invoice.voucher_number} erstellt`
          : "Formale Rechnung erstellt",
      );
      onOpenChange(false);
      onCreated?.(json.invoice.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("template")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Formale Rechnung
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Aus der POS-Quittung eine richtige Rechnung mit Empfängeradresse
            erzeugen.
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : !draft ? (
            <p className="text-sm text-muted-foreground">
              Entwurf nicht verfügbar.
            </p>
          ) : draft.alreadyInvoiced && !draft.alreadyStornoed ? (
            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-6 text-sm">
              <p className="font-medium">Bereits verrechnet</p>
              <p className="mt-1 text-muted-foreground">
                Für diese Quittung gibt es schon eine formale Rechnung
                {draft.existingInvoiceNumber
                  ? ` (${draft.existingInvoiceNumber})`
                  : ""}
                .
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {draft.existingInvoiceId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      window.open(
                        `/dashboard/buchfuehrung/rechnungen?highlight=${encodeURIComponent(draft.existingInvoiceId!)}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    Zur Rechnung
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={stornoBusy}
                  onClick={() => void stornoInvoice()}
                >
                  {stornoBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Rechnung stornieren
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {draft.alreadyStornoed ? (
                <p className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
                  Vorherige Rechnung
                  {draft.existingInvoiceNumber
                    ? ` ${draft.existingInvoiceNumber}`
                    : ""}{" "}
                  ist storniert
                  {draft.existingCorrectionNumber
                    ? ` (Korrektur ${draft.existingCorrectionNumber})`
                    : ""}
                  . Du kannst eine neue formale Rechnung anlegen.
                </p>
              ) : null}
              <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-3 text-sm">
                <p className="font-medium">
                  Bon #{draft.orderNumber} ·{" "}
                  {formatCents(draft.amountCents + draft.tipCents)}
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {draft.lineItems.map((line, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {line.quantity}× {line.name}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatEuro(line.lineAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pos-inv-company">Firmenname</Label>
                  <Input
                    id="pos-inv-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="optional"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pos-inv-person">Name / Ansprechpartner</Label>
                  <Input
                    id="pos-inv-person"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="Pflicht, falls keine Firma"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pos-inv-street">Straße</Label>
                  <Input
                    id="pos-inv-street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-inv-zip">PLZ</Label>
                  <Input
                    id="pos-inv-zip"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-inv-city">Ort</Label>
                  <Input
                    id="pos-inv-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-inv-email">E-Mail</Label>
                  <Input
                    id="pos-inv-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-inv-phone">Telefon</Label>
                  <Input
                    id="pos-inv-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pos-inv-date">Rechnungsdatum</Label>
                  <DatePickerField
                    id="pos-inv-date"
                    value={voucherDate}
                    onChange={(v) => setVoucherDate(v ?? voucherDate)}
                    fullWidth
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          {!draft?.alreadyInvoiced || draft.alreadyStornoed ? (
            <Button
              type="button"
              className={cn("flex-1", brandActionButtonRoundedClassName)}
              disabled={
                saving ||
                loading ||
                !draft ||
                (draft.alreadyInvoiced && !draft.alreadyStornoed) ||
                (!companyName.trim() && !personName.trim())
              }
              onClick={() => void createInvoice()}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Rechnung erstellen
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
