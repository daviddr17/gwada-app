"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag, Trash2 } from "lucide-react";
import { GuestOrderConfigureSheet } from "@/components/ordering/guest-order-configure-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  cartSubtotalCents,
  formatEuroFromCents,
  type GuestCartLine,
} from "@/lib/ordering/guest-cart-types";
import type { PublicOrderingRecipeIngredient } from "@/lib/ordering/online-ordering-types";
import type { MenuItem, MenuOptionGroup } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type PublicSettings = {
  onlineEnabled: boolean;
  kioskEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  minOrderCentsPickup: number;
  minOrderCentsDelivery: number;
  deliveryFeeCents: number;
  deliveryZones: Array<{
    postalCode: string;
    feeCents?: number;
    minOrderCents?: number;
  }>;
  pickupLeadMinutes: number;
  deliveryLeadMinutes: number;
  kioskIdleSeconds: number;
  guestStatusMessage: string | null;
  timeslotsEnabled?: boolean;
  slotIntervalMinutes?: number;
  hasKioskTerminal?: boolean;
};

type OrderingSlot = {
  startAt: string;
  endAt: string;
  remaining: number;
  label: string;
};

type OrderingPayload = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    accentHex: string;
    currencyCode: string;
  };
  settings: PublicSettings;
  menu: {
    categories: Array<{ id: string; name: string; active: boolean }>;
    items: MenuItem[];
    optionGroups: MenuOptionGroup[];
    recipeByItemId?: Record<string, PublicOrderingRecipeIngredient[]>;
    guestOrderingEnabled: boolean;
  };
};

export type GuestOrderingMode = "online" | "kiosk" | "table";

type Step = "menu" | "cart" | "checkout" | "busy";

type Props = {
  slug: string;
  mode: GuestOrderingMode;
  diningTableId?: string;
  largeTouch?: boolean;
  className?: string;
  onIdleReset?: () => void;
  /** Called after successful checkout redirect prep */
  onOrderPlaced?: (info: {
    statusToken: string;
    orderNumber: number;
    checkoutUrl: string | null;
  }) => void;
};

export function GuestOrderingApp({
  slug,
  mode,
  diningTableId,
  largeTouch = false,
  className,
  onIdleReset,
  onOrderPlaced,
}: Props) {
  const [data, setData] = useState<OrderingPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<GuestCartLine[]>([]);
  const [step, setStep] = useState<Step>("menu");
  const [configureItem, setConfigureItem] = useState<MenuItem | null>(null);
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery" | "dine_in">(
    mode === "table" ? "dine_in" : "pickup",
  );
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [slots, setSlots] = useState<OrderingSlot[]>([]);
  const [slotStartAt, setSlotStartAt] = useState<string | null>(null);
  const [terminalWaiting, setTerminalWaiting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/public/ordering/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as OrderingPayload & { error?: string };
      if (!res.ok) {
        setLoadError(json.error ?? "Laden fehlgeschlagen");
        setData(null);
        return;
      }
      setData(json);
      if (mode === "online" && json.settings.pickupEnabled) {
        setFulfillment("pickup");
      } else if (mode === "online" && json.settings.deliveryEnabled) {
        setFulfillment("delivery");
      } else if (mode === "table") {
        setFulfillment("dine_in");
      } else if (json.settings.pickupEnabled) {
        setFulfillment("pickup");
      }
    } catch {
      setLoadError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }, [slug, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.settings.timeslotsEnabled) {
      setSlots([]);
      setSlotStartAt(null);
      return;
    }
    if (fulfillment !== "pickup" && fulfillment !== "delivery") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/ordering/${encodeURIComponent(slug)}/slots?fulfillment=${fulfillment}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { slots?: OrderingSlot[] };
        if (cancelled) return;
        setSlots(json.slots ?? []);
        setSlotStartAt((prev) => {
          const list = json.slots ?? [];
          if (prev && list.some((s) => s.startAt === prev)) return prev;
          return list[0]?.startAt ?? null;
        });
      } catch {
        if (!cancelled) setSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.settings.timeslotsEnabled, fulfillment, slug]);

  const accent = data?.restaurant.accentHex ?? "#0f766e";
  const subtotal = cartSubtotalCents(cart);

  const deliveryFee = useMemo(() => {
    if (fulfillment !== "delivery" || !data) return 0;
    const code = deliveryPostalCode.trim().replace(/\s+/g, "");
    const zone = data.settings.deliveryZones.find(
      (z) => z.postalCode.replace(/\s+/g, "") === code,
    );
    if (data.settings.deliveryZones.length > 0) {
      return zone?.feeCents ?? data.settings.deliveryFeeCents;
    }
    return data.settings.deliveryFeeCents;
  }, [fulfillment, data, deliveryPostalCode]);

  const total = subtotal + (fulfillment === "delivery" ? deliveryFee : 0);

  const categories = useMemo(
    () => (data?.menu.categories ?? []).filter((c) => c.active),
    [data],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.menu.items ?? []).filter((item) => {
      if (!item.active) return false;
      if (categoryId !== "all" && item.category !== categoryId) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [data, categoryId, search]);

  function addLine(line: Omit<GuestCartLine, "key">) {
    const key = `${line.menuItemId}-${JSON.stringify(line.modifiers)}-${Date.now()}`;
    setCart((prev) => [...prev, { ...line, key }]);
  }

  async function submitCheckout() {
    if (!data) return;
    setCheckoutError(null);
    setSubmitting(true);
    setStep("busy");
    try {
      const channel = mode;
      const redirectPathTemplate =
        mode === "online"
          ? `/order/${data.restaurant.slug}/status/{token}?paid=1`
          : `/kiosk/${data.restaurant.slug}/thanks/{token}`;

      const useTerminal =
        mode === "kiosk" && Boolean(data.settings.hasKioskTerminal);
      const res = await fetch(
        `/api/public/ordering/${encodeURIComponent(slug)}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            fulfillmentType: fulfillment,
            guestName: guestName.trim() || (mode === "kiosk" ? "Kiosk" : "Gast"),
            guestPhone: guestPhone.trim() || undefined,
            guestEmail: guestEmail.trim() || undefined,
            deliveryAddress: deliveryAddress.trim() || undefined,
            deliveryCity: deliveryCity.trim() || undefined,
            deliveryPostalCode: deliveryPostalCode.trim() || undefined,
            diningTableId,
            slotStartAt: slotStartAt || undefined,
            payWithTerminal: useTerminal,
            items: cart.map((l) => ({
              menuItemId: l.menuItemId,
              quantity: l.quantity,
              notes: l.notes,
              ohneIngredientIds: l.ohneIngredientIds,
              modifiers: l.modifiers,
            })),
            redirectPathTemplate,
          }),
        },
      );
      const json = (await res.json()) as {
        error?: string;
        statusToken?: string;
        orderNumber?: number;
        checkoutUrl?: string | null;
        molliePaymentId?: string | null;
        paymentMode?: "hosted" | "terminal";
      };
      if (!res.ok || !json.statusToken) {
        setCheckoutError(mapCheckoutError(json.error));
        setStep("checkout");
        return;
      }

      if (json.paymentMode === "terminal" && json.molliePaymentId) {
        setTerminalWaiting(true);
        const paid = await pollTerminalPayment(
          json.statusToken,
          json.molliePaymentId,
        );
        setTerminalWaiting(false);
        if (!paid) {
          setCheckoutError(
            "Zahlung am Terminal nicht bestätigt. Bitte erneut versuchen oder Staff rufen.",
          );
          setStep("checkout");
          return;
        }
        onOrderPlaced?.({
          statusToken: json.statusToken,
          orderNumber: json.orderNumber ?? 0,
          checkoutUrl: null,
        });
        setCart([]);
        return;
      }

      onOrderPlaced?.({
        statusToken: json.statusToken,
        orderNumber: json.orderNumber ?? 0,
        checkoutUrl: json.checkoutUrl ?? null,
      });
      if (json.checkoutUrl) {
        window.location.assign(json.checkoutUrl);
        return;
      }
      if (mode === "online") {
        window.location.assign(
          `/order/${data.restaurant.slug}/status/${json.statusToken}`,
        );
      }
    } catch {
      setCheckoutError("Bestellung konnte nicht gestartet werden.");
      setStep("checkout");
    } finally {
      setSubmitting(false);
      setTerminalWaiting(false);
    }
  }

  async function pollTerminalPayment(
    statusToken: string,
    molliePaymentId: string,
  ): Promise<boolean> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(
          `/api/public/ordering/status/${encodeURIComponent(statusToken)}/payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ molliePaymentId }),
          },
        );
        const json = (await res.json()) as { paid?: boolean };
        if (json.paid) return true;
      } catch {
        /* retry */
      }
      await new Promise((r) => window.setTimeout(r, 2000));
    }
    return false;
  }

  if (showSkeleton) {
    return (
      <div className={cn("space-y-4 p-4", className)} aria-busy>
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className={cn("p-6 text-center text-muted-foreground", className)}>
        {loadError ?? "Nicht verfügbar"}
      </div>
    );
  }

  const channelAllowed =
    mode === "online"
      ? data.settings.onlineEnabled
      : data.settings.kioskEnabled;

  if (!channelAllowed) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <p className={cn("font-medium", largeTouch && "text-2xl")}>
          Bestellen ist derzeit nicht freigeschaltet.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {step === "menu" || step === "cart" ? (
        <>
          <header className="shrink-0 border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className={cn(
                    "font-semibold tracking-tight",
                    largeTouch ? "text-2xl" : "text-lg",
                  )}
                >
                  {data.restaurant.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mode === "online"
                    ? "Online bestellen"
                    : mode === "table"
                      ? "Tischbestellung"
                      : "Kiosk"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "relative rounded-full",
                  largeTouch && "h-14 min-w-14",
                )}
                onClick={() => setStep(cart.length ? "cart" : "menu")}
              >
                <ShoppingBag className={largeTouch ? "size-6" : "size-4"} />
                {cart.length > 0 ? (
                  <span
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {cart.reduce((s, l) => s + l.quantity, 0)}
                  </span>
                ) : null}
              </Button>
            </div>
            {step === "menu" ? (
              <div className="mt-3 space-y-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suchen …"
                  className={cn(largeTouch && "h-14 text-lg")}
                />
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Chip
                    active={categoryId === "all"}
                    accent={accent}
                    large={largeTouch}
                    onClick={() => setCategoryId("all")}
                  >
                    Alle
                  </Chip>
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      active={categoryId === c.id}
                      accent={accent}
                      large={largeTouch}
                      onClick={() => setCategoryId(c.id)}
                    >
                      {c.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </header>

          {step === "menu" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div
                className={cn(
                  "grid gap-3",
                  largeTouch
                    ? "sm:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2",
                )}
              >
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConfigureItem(item)}
                    className={cn(
                      "rounded-2xl border border-border/50 bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99]",
                      largeTouch && "min-h-28 p-5",
                    )}
                  >
                    <p
                      className={cn(
                        "font-semibold",
                        largeTouch && "text-xl",
                      )}
                    >
                      {item.name}
                    </p>
                    {item.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "mt-3 font-medium",
                        largeTouch && "text-lg",
                      )}
                      style={{ color: accent }}
                    >
                      {formatEuroFromCents(Math.round(Number(item.price) * 100))}
                    </p>
                  </button>
                ))}
              </div>
              {filteredItems.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  Keine Gerichte gefunden.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ul className="space-y-3">
                {cart.map((line) => (
                  <li
                    key={line.key}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 p-4"
                  >
                    <div>
                      <p className={cn("font-medium", largeTouch && "text-lg")}>
                        {line.quantity}× {line.name}
                      </p>
                      {line.modifiers.length > 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {line.modifiers.map((m) => m.label).join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-2 font-medium">
                        {formatEuroFromCents(line.unitPriceCents * line.quantity)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(largeTouch && "size-12")}
                      onClick={() =>
                        setCart((prev) => prev.filter((l) => l.key !== line.key))
                      }
                    >
                      <Trash2 className="size-5" />
                    </Button>
                  </li>
                ))}
              </ul>
              {cart.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  Warenkorb ist leer.
                </p>
              ) : null}
            </div>
          )}

          <footer className="shrink-0 border-t border-border/50 p-4">
            {step === "menu" && cart.length > 0 ? (
              <Button
                type="button"
                size="lg"
                className={cn(
                  "w-full rounded-xl text-white",
                  largeTouch && "h-16 text-lg",
                )}
                style={{ backgroundColor: accent }}
                onClick={() => setStep("cart")}
              >
                Warenkorb · {formatEuroFromCents(subtotal)}
              </Button>
            ) : null}
            {step === "cart" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className={cn("rounded-xl", largeTouch && "h-16 flex-1 text-lg")}
                  onClick={() => setStep("menu")}
                >
                  Weiter bestellen
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className={cn(
                    "rounded-xl text-white",
                    largeTouch ? "h-16 flex-[2] text-lg" : "flex-1",
                  )}
                  style={{ backgroundColor: accent }}
                  disabled={!cart.length}
                  onClick={() => setStep("checkout")}
                >
                  Zur Kasse
                </Button>
              </div>
            ) : null}
          </footer>
        </>
      ) : null}

      {step === "checkout" || step === "busy" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <button
            type="button"
            className="mb-4 text-sm text-muted-foreground underline"
            onClick={() => !submitting && setStep("cart")}
          >
            Zurück zum Warenkorb
          </button>
          <h2 className={cn("font-semibold", largeTouch && "text-2xl")}>
            Checkout
          </h2>

          {mode === "online" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.settings.pickupEnabled ? (
                <Chip
                  active={fulfillment === "pickup"}
                  accent={accent}
                  large={largeTouch}
                  onClick={() => setFulfillment("pickup")}
                >
                  Abholung
                </Chip>
              ) : null}
              {data.settings.deliveryEnabled ? (
                <Chip
                  active={fulfillment === "delivery"}
                  accent={accent}
                  large={largeTouch}
                  onClick={() => setFulfillment("delivery")}
                >
                  Lieferung
                </Chip>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {mode === "online" ? (
              <>
                <Field
                  label="Name"
                  value={guestName}
                  onChange={setGuestName}
                  large={largeTouch}
                  required
                />
                <Field
                  label="Telefon"
                  value={guestPhone}
                  onChange={setGuestPhone}
                  large={largeTouch}
                />
                <Field
                  label="E-Mail"
                  value={guestEmail}
                  onChange={setGuestEmail}
                  large={largeTouch}
                />
              </>
            ) : null}
            {fulfillment === "delivery" ? (
              <>
                <Field
                  label="Straße und Hausnummer"
                  value={deliveryAddress}
                  onChange={setDeliveryAddress}
                  large={largeTouch}
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="PLZ"
                    value={deliveryPostalCode}
                    onChange={setDeliveryPostalCode}
                    large={largeTouch}
                    required
                  />
                  <Field
                    label="Ort"
                    value={deliveryCity}
                    onChange={setDeliveryCity}
                    large={largeTouch}
                  />
                </div>
              </>
            ) : null}
            {data.settings.timeslotsEnabled &&
            (fulfillment === "pickup" || fulfillment === "delivery") ? (
              <div className="space-y-2">
                <Label>Zeitfenster</Label>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Chip
                      key={s.startAt}
                      active={slotStartAt === s.startAt}
                      accent={accent}
                      large={largeTouch}
                      onClick={() => setSlotStartAt(s.startAt)}
                    >
                      {s.label}
                    </Chip>
                  ))}
                </div>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine freien Zeitslots.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-1 rounded-2xl border border-border/50 p-4">
            <Row label="Zwischensumme" value={formatEuroFromCents(subtotal)} />
            {fulfillment === "delivery" ? (
              <Row
                label="Liefergebühr"
                value={formatEuroFromCents(deliveryFee)}
              />
            ) : null}
            <Row
              label="Gesamt"
              value={formatEuroFromCents(total)}
              strong
            />
          </div>

          {checkoutError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {checkoutError}
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            className={cn(
              "mt-4 w-full rounded-xl text-white",
              largeTouch && "h-16 text-lg",
            )}
            style={{ backgroundColor: accent }}
            disabled={
              submitting ||
              !cart.length ||
              (Boolean(data.settings.timeslotsEnabled) &&
                (fulfillment === "pickup" || fulfillment === "delivery") &&
                !slotStartAt)
            }
            onClick={() => void submitCheckout()}
          >
            {terminalWaiting
              ? "Bitte am Terminal zahlen …"
              : submitting
                ? "Wird vorbereitet …"
                : mode === "kiosk" && data.settings.hasKioskTerminal
                  ? "Am Terminal bezahlen"
                  : "Jetzt bezahlen"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {mode === "kiosk" && data.settings.hasKioskTerminal
              ? "Zahlung über Mollie-Terminal am Kiosk."
              : "Sichere Zahlung über Mollie. Nach der Zahlung siehst du den Live-Status."}
          </p>
        </div>
      ) : null}

      <GuestOrderConfigureSheet
        open={Boolean(configureItem)}
        onOpenChange={(open) => {
          if (!open) setConfigureItem(null);
        }}
        item={configureItem}
        optionGroups={data.menu.optionGroups}
        recipe={
          configureItem
            ? (data.menu.recipeByItemId?.[configureItem.id] ?? [])
            : []
        }
        accentHex={accent}
        largeTouch={largeTouch}
        onConfirm={addLine}
      />

      {onIdleReset ? (
        <IdleWatcher
          seconds={data.settings.kioskIdleSeconds}
          onIdle={() => {
            setCart([]);
            setStep("menu");
            setConfigureItem(null);
            onIdleReset();
          }}
        />
      ) : null}
    </div>
  );
}

function Chip({
  children,
  active,
  accent,
  large,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  accent: string;
  large?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
        large && "min-h-12 px-5 text-base",
        active ? "border-transparent text-white" : "border-border/60",
      )}
      style={active ? { backgroundColor: accent } : undefined}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  large,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  large?: boolean;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(large && "h-14 text-lg")}
      />
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 text-sm",
        strong && "text-base font-semibold",
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function IdleWatcher({
  seconds,
  onIdle,
}: {
  seconds: number;
  onIdle: () => void;
}) {
  useEffect(() => {
    let timer = window.setTimeout(onIdle, seconds * 1000);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, seconds * 1000);
    };
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [seconds, onIdle]);
  return null;
}

function mapCheckoutError(code?: string): string {
  switch (code) {
    case "below_min_order":
      return "Mindestbestellwert nicht erreicht.";
    case "outside_delivery_zone":
      return "Diese PLZ liegt außerhalb der Lieferzone.";
    case "postal_code_required":
      return "Bitte PLZ angeben.";
    case "delivery_address_required":
      return "Bitte Lieferadresse angeben.";
    case "guest_name_required":
      return "Bitte Namen angeben.";
    case "mollie_not_connected":
    case "not_connected":
      return "Zahlung ist noch nicht eingerichtet. Bitte später erneut versuchen.";
    case "online_disabled":
    case "kiosk_disabled":
      return "Bestellen ist derzeit deaktiviert.";
    case "slot_required":
    case "slot_unavailable":
      return "Bitte ein verfügbares Zeitfenster wählen.";
    case "terminal_required":
      return "Kein Mollie-Terminal für den Kiosk konfiguriert.";
    case "mollie_pos_not_enabled":
      return "Mollie POS/Terminal ist noch nicht freigeschaltet.";
    default:
      return code ? `Fehler: ${code}` : "Checkout fehlgeschlagen.";
  }
}
