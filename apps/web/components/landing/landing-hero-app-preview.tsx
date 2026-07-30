"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  MessageCircle,
  MonitorSmartphone,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HeroTabId =
  | "dashboard"
  | "menu"
  | "reservierungen"
  | "kontakte"
  | "pos"
  | "mitarbeiter";

type HeroTab = {
  id: HeroTabId;
  label: string;
  shortLabel: string;
  path: string;
  icon: LucideIcon;
};

const HERO_TABS: readonly HeroTab[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    path: "app.gwada /dashboard",
    icon: MonitorSmartphone,
  },
  {
    id: "menu",
    label: "Speisekarte",
    shortLabel: "Menü",
    path: "app.gwada /dashboard/menu",
    icon: UtensilsCrossed,
  },
  {
    id: "reservierungen",
    label: "Reservierungen",
    shortLabel: "Resa",
    path: "app.gwada /dashboard/reservierungen",
    icon: CalendarDays,
  },
  {
    id: "kontakte",
    label: "Nachrichten",
    shortLabel: "Chat",
    path: "app.gwada /dashboard/kontakte",
    icon: MessageCircle,
  },
  {
    id: "pos",
    label: "POS",
    shortLabel: "POS",
    path: "app.gwada /dashboard/pos",
    icon: MonitorSmartphone,
  },
  {
    id: "mitarbeiter",
    label: "Mitarbeiter",
    shortLabel: "Team",
    path: "app.gwada /dashboard/mitarbeiter",
    icon: Users,
  },
] as const;

const AUTO_MS = 4200;

function PanelDashboard() {
  return (
    <div className="grid h-full grid-cols-3 gap-1.5 p-2.5 sm:gap-2 sm:p-3">
      {[
        { label: "Reservierungen", value: "12", hint: "heute" },
        { label: "Nachrichten", value: "3", hint: "neu" },
        { label: "Im Dienst", value: "5", hint: "jetzt" },
      ].map((tile, i) => (
        <div
          key={tile.label}
          className={cn(
            "rounded-xl border border-border/50 bg-background/80 p-2 text-left shadow-sm dark:bg-background/40 sm:p-2.5",
            i === 0 && "landing-hero-preview-kpi",
          )}
        >
          <p className="truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            {tile.label}
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">
            {tile.value}
          </p>
          <p className="text-[9px] text-muted-foreground sm:text-[10px]">
            {tile.hint}
          </p>
        </div>
      ))}
      <div className="col-span-3 space-y-1.5 rounded-xl border border-border/50 bg-background/60 p-2 text-left dark:bg-background/30">
        {[
          { t: "Tisch 4 · 19:30", m: "4 Personen · bestätigt", c: "bg-emerald-500" },
          { t: "WhatsApp · Anna M.", m: "„Haben Sie noch Platz?“", c: "bg-accent" },
        ].map((row) => (
          <div key={row.t} className="flex items-center gap-2 px-1">
            <span className={cn("size-1.5 shrink-0 rounded-full", row.c)} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium sm:text-xs">{row.t}</p>
              <p className="truncate text-[10px] text-muted-foreground">{row.m}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelMenu() {
  const dishes = [
    { name: "Tagliatelle al limone", price: "18,50", cat: "Pasta" },
    { name: "Feldsalat mit Birne", price: "12,00", cat: "Vorspeise" },
    { name: "Tagesempfehlung", price: "9,50", cat: "Mittag" },
  ];
  return (
    <div className="flex h-full flex-col gap-1.5 p-2.5 sm:p-3">
      <div className="flex gap-1.5">
        {["Vorspeisen", "Pasta", "Getränke"].map((cat, i) => (
          <span
            key={cat}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium",
              i === 1
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            {cat}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {dishes.map((d) => (
          <div
            key={d.name}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/80 px-2.5 py-2 text-left dark:bg-background/40"
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium sm:text-xs">{d.name}</p>
              <p className="text-[10px] text-muted-foreground">{d.cat}</p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums">
              {d.price}€
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelReservations() {
  const rows = [
    { time: "18:00", table: "Tisch 2", party: "2", status: "bestätigt" },
    { time: "19:30", table: "Tisch 4", party: "4", status: "bestätigt" },
    { time: "20:15", table: "Tisch 7", party: "6", status: "offen" },
  ];
  return (
    <div className="flex h-full flex-col gap-1.5 p-2.5 sm:p-3">
      <div className="flex items-center justify-between px-0.5 text-left">
        <p className="text-[11px] font-semibold">Heute</p>
        <p className="text-[10px] text-muted-foreground">12 Reservierungen</p>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.time + r.table}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/80 px-2.5 py-2 text-left dark:bg-background/40"
          >
            <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-primary">
              {r.time}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium sm:text-xs">
                {r.table} · {r.party} Pers.
              </p>
              <p className="text-[10px] text-muted-foreground">{r.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelMessages() {
  const threads = [
    { from: "Anna M.", ch: "WhatsApp", preview: "Haben Sie noch Platz um 20?", unread: true },
    { from: "Hotel am Markt", ch: "E-Mail", preview: "Reservierung für 8 Personen", unread: true },
    { from: "Lukas K.", ch: "Instagram", preview: "Danke für gestern!", unread: false },
  ];
  return (
    <div className="flex h-full flex-col gap-1 p-2.5 sm:p-3">
      {threads.map((t) => (
        <div
          key={t.from}
          className="flex items-start gap-2 rounded-xl border border-border/50 bg-background/80 px-2.5 py-2 text-left dark:bg-background/40"
        >
          <span
            className={cn(
              "mt-1 size-2 shrink-0 rounded-full",
              t.unread ? "bg-accent" : "bg-muted-foreground/30",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[11px] font-medium sm:text-xs">{t.from}</p>
              <span className="shrink-0 text-[9px] text-muted-foreground">{t.ch}</span>
            </div>
            <p className="truncate text-[10px] text-muted-foreground">{t.preview}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelPos() {
  return (
    <div className="grid h-full grid-cols-[1.1fr_0.9fr] gap-1.5 p-2.5 sm:gap-2 sm:p-3">
      <div className="space-y-1.5 rounded-xl border border-border/50 bg-background/80 p-2 text-left dark:bg-background/40">
        <p className="text-[10px] font-semibold text-muted-foreground">Tisch 5</p>
        {[
          { n: "Espresso", p: "2,80" },
          { n: "Tagliatelle", p: "18,50" },
          { n: "Wasser 0,75", p: "4,20" },
        ].map((l) => (
          <div key={l.n} className="flex justify-between text-[11px]">
            <span className="truncate">{l.n}</span>
            <span className="tabular-nums text-muted-foreground">{l.p}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-primary/10 p-2.5 text-left">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground">Summe</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight">25,50€</p>
        </div>
        <div className="rounded-lg bg-primary px-2 py-1.5 text-center text-[11px] font-medium text-primary-foreground">
          Bezahlen
        </div>
      </div>
    </div>
  );
}

function PanelStaff() {
  const people = [
    { name: "Mara", role: "Service", state: "im Dienst" },
    { name: "Jonas", role: "Küche", state: "Schicht 16–23" },
    { name: "Elena", role: "Bar", state: "frei" },
  ];
  return (
    <div className="flex h-full flex-col gap-1.5 p-2.5 sm:p-3">
      {people.map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/80 px-2.5 py-2 text-left dark:bg-background/40"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
            {p.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium sm:text-xs">{p.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {p.role} · {p.state}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabPanel({ id }: { id: HeroTabId }) {
  switch (id) {
    case "menu":
      return <PanelMenu />;
    case "reservierungen":
      return <PanelReservations />;
    case "kontakte":
      return <PanelMessages />;
    case "pos":
      return <PanelPos />;
    case "mitarbeiter":
      return <PanelStaff />;
    default:
      return <PanelDashboard />;
  }
}

/**
 * Safari-ähnliches App-Fenster: Tabs laufen automatisch durch und sind klickbar.
 */
export function LandingHeroAppPreview({ className }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = HERO_TABS[activeIndex] ?? HERO_TABS[0];

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % HERO_TABS.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className={cn("landing-hero-rise-preview w-full", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div
        role="region"
        aria-label="App-Vorschau"
        className={cn(
          "overflow-hidden rounded-xl border border-neutral-200/80 bg-[#e8e9ed]/95 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.22)]",
          "ring-1 ring-black/[0.03]",
          "dark:border-white/10 dark:bg-[#1c1f2a]/95 dark:shadow-[0_12px_40px_-20px_rgba(0,0,0,0.55)] dark:ring-white/[0.05]",
        )}
      >
        {/* Title bar + traffic lights */}
        <div className="flex items-center gap-3 border-b border-black/5 px-3 py-2 dark:border-white/10">
          <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <p className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-neutral-600 dark:text-white/70">
            gwada
          </p>
          <span className="w-10 shrink-0" aria-hidden />
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Module"
          className="flex gap-0.5 overflow-x-auto border-b border-black/5 bg-[#dfe1e6]/80 px-1.5 pt-1.5 dark:border-white/10 dark:bg-black/25"
        >
          {HERO_TABS.map((tab, index) => {
            const Icon = tab.icon;
            const selected = index === activeIndex;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`hero-tab-${tab.id}`}
                aria-controls={`hero-panel-${tab.id}`}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative flex min-w-0 shrink-0 items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  selected
                    ? "bg-card text-foreground shadow-sm dark:bg-[#121826]"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5",
                )}
              >
                <Icon className="size-3 shrink-0 opacity-80" aria-hidden />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {selected ? (
                  <span
                    className="landing-hero-tab-progress absolute inset-x-1 bottom-0 h-0.5 origin-left rounded-full bg-primary/80"
                    style={{ animationDuration: `${AUTO_MS}ms` }}
                    data-paused={paused ? "true" : undefined}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Address bar */}
        <div className="border-b border-border/40 bg-card px-3 py-1.5 dark:bg-[#121826]">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-1 text-[10px] text-muted-foreground dark:bg-black/35">
            <span
              className="size-1.5 shrink-0 rounded-full bg-emerald-500"
              aria-hidden
            />
            <span className="min-w-0 truncate font-medium tracking-tight">
              {active.path}
            </span>
          </div>
        </div>

        {/* Content */}
        <div
          role="tabpanel"
          id={`hero-panel-${active.id}`}
          aria-labelledby={`hero-tab-${active.id}`}
          className="h-[12.5rem] bg-card dark:bg-[#121826] sm:h-[14rem] md:h-[15rem]"
        >
          <div
            key={active.id}
            className="landing-hero-panel-in h-full"
          >
            <TabPanel id={active.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
