"use client";

import type { ReactNode } from "react";
import {
  Filter,
  LayoutGrid,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  brandActionButtonPillClassName,
  brandActionButtonRoundedClassName,
} from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  drawerFormFooterActionsRowClassName,
  drawerFormFooterCancelButtonClassName,
  drawerFormFooterSaveButtonClassName,
  drawerFormFooterShellClassName,
} from "@/components/ui/drawer-form-footer";
import {
  drawerFormSectionBodyClassName,
  drawerFormSectionTintClassName,
  drawerFormSectionTitleClassName,
} from "@/lib/ui/drawer-form-section";
import {
  INTEGRATION_PANEL_ACCENT,
  integrationPanelAccentBorderColor,
} from "@/lib/ui/integration-panel-accent";
import {
  modulePrimaryAddButtonClassName,
  modulePrimaryAddButtonFullWidthClassName,
} from "@/lib/ui/module-primary-add-button";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import {
  moduleSearchFilterButtonClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import {
  superadminCardGrid2ClassName,
  superadminCardGrid3ClassName,
} from "@/lib/ui/superadmin-card-grid";
import { staffTodoPriorityBadgeClass } from "@/lib/staff/staff-todo-status";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "buttons", label: "Buttons" },
  { id: "cards", label: "Karten" },
  { id: "forms", label: "Formular" },
  { id: "lists", label: "Listen" },
  { id: "badges", label: "Badges" },
  { id: "loading", label: "Skeleton" },
  { id: "integrations", label: "Integrationen" },
] as const;

type DesignSectionProps = {
  id: string;
  title: string;
  description: string;
  sources: string[];
  children: ReactNode;
};

function DesignSection({
  id,
  title,
  description,
  sources,
  children,
}: DesignSectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {sources.map((source) => (
              <code
                key={source}
                className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {source}
              </code>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">{children}</CardContent>
      </Card>
    </section>
  );
}

function SampleLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function SampleRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <SampleLabel>{label}</SampleLabel>
      {children}
    </div>
  );
}

export function SuperadminDesignShowcase() {
  return (
    <div className="space-y-6 pt-2 pb-8">
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardDescription>
            Module nutzen shadcn/ui-Bausteine und gemeinsame Klassen aus{" "}
            <code className="text-xs">lib/ui/</code> — keine Einzel-Styles pro
            Seite. Tailwind dedupliziert Klassen beim Build; diese Seite ist
            statisch und lädt keine Remote-Daten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <nav
            aria-label="Design-Abschnitte"
            className="flex flex-wrap gap-2"
          >
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-border/60"
                nativeButton={false}
                render={<a href={`#${item.id}`} />}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </CardContent>
      </Card>

      <DesignSection
        id="buttons"
        title="Buttons"
        description="shadcn-Varianten plus Tenant-Akzent-Aktionen für Speichern und „Neu anlegen“."
        sources={[
          "components/ui/button.tsx",
          "lib/ui/brand-action-button.ts",
          "lib/ui/module-primary-add-button.ts",
        ]}
      >
        <SampleRow label="shadcn — Varianten">
          <div className="flex flex-wrap gap-2">
            <Button type="button">Default</Button>
            <Button type="button" variant="secondary">
              Secondary
            </Button>
            <Button type="button" variant="outline">
              Outline
            </Button>
            <Button type="button" variant="ghost">
              Ghost
            </Button>
            <Button type="button" variant="destructive">
              Destructive
            </Button>
            <Button type="button" variant="link">
              Link
            </Button>
          </div>
        </SampleRow>
        <SampleRow label="shadcn — Größen">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="xs">
              XS
            </Button>
            <Button type="button" size="sm">
              SM
            </Button>
            <Button type="button" size="default">
              Default
            </Button>
            <Button type="button" size="lg">
              LG
            </Button>
            <Button type="button" size="icon-sm" variant="outline">
              <Search className="size-3.5" />
            </Button>
          </div>
        </SampleRow>
        <SampleRow label="Brand-Aktion — Speichern / Absenden">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={brandActionButtonRoundedClassName}
            >
              Speichern
            </Button>
            <Button
              type="button"
              className={cn(brandActionButtonRoundedClassName, "min-w-[8rem]")}
            >
              Fertig
            </Button>
          </div>
        </SampleRow>
        <SampleRow label="Modul — Neu anlegen (Pill)">
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonClassName}
          >
            <Plus className="size-4" />
            Neu anlegen
          </Button>
        </SampleRow>
        <SampleRow label="Modul — Neu anlegen (volle Breite)">
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
          >
            <Plus className="size-4" />
            Dokument hinzufügen
          </Button>
        </SampleRow>
        <SampleRow label="Drawer-Fußzeile (Abbrechen · Speichern)">
          <div
            className={cn(
              drawerFormFooterShellClassName(6),
              "rounded-xl border border-border/50",
            )}
          >
            <div className={drawerFormFooterActionsRowClassName}>
              <Button
                type="button"
                variant="outline"
                className={drawerFormFooterCancelButtonClassName}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                className={drawerFormFooterSaveButtonClassName}
              >
                Speichern
              </Button>
            </div>
          </div>
        </SampleRow>
        <SampleRow label="Verwalten-Chip">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={moduleManageChipButtonClassName}
          >
            <LayoutGrid className="size-3.5" />
            Bereiche verwalten
          </Button>
        </SampleRow>
      </DesignSection>

      <DesignSection
        id="cards"
        title="Karten & Layout"
        description="Standard-Modulkarten, Superadmin-Raster und Drawer-Abschnitte."
        sources={[
          "components/ui/card.tsx",
          "lib/ui/superadmin-card-grid.ts",
          "lib/ui/drawer-form-section.ts",
        ]}
      >
        <SampleRow label="Modul-Karte (border-border/50 · shadow-card)">
          <Card className="border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="text-sm">Beispiel-Karte</CardTitle>
              <CardDescription>
                Wie in Dashboard, Bestand, Dokumente …
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Inhalt ohne doppelten Modultitel unter RegisterModuleChrome.
              </p>
            </CardContent>
          </Card>
        </SampleRow>
        <SampleRow label="Superadmin — 2-Spalten-Raster">
          <div className={superadminCardGrid2ClassName}>
            <Card className="border-border/50 shadow-card">
              <CardContent>
                <p className="text-sm font-medium">Spalte A</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-card">
              <CardContent>
                <p className="text-sm font-medium">Spalte B</p>
              </CardContent>
            </Card>
          </div>
        </SampleRow>
        <SampleRow label="Superadmin — 3-Spalten-KPI-Raster">
          <div className={superadminCardGrid3ClassName}>
            <KpiCard label="Beispiel" value="12" />
            <KpiCard label="Beispiel" value="45" icon={TrendingUp} />
            <KpiCard label="Beispiel" value="3" hint="Hinweis" />
          </div>
        </SampleRow>
        <SampleRow label="Drawer-Abschnitt (getönt)">
          <div
            className={cn(
              drawerFormSectionTintClassName,
              "rounded-xl border border-border/50 px-4",
            )}
          >
            <p className={drawerFormSectionTitleClassName}>Abschnitt</p>
            <div className={cn(drawerFormSectionBodyClassName, "mt-3")}>
              <Input placeholder="Feld im Sheet-Abschnitt" />
            </div>
          </div>
        </SampleRow>
      </DesignSection>

      <DesignSection
        id="forms"
        title="Formular & Eingaben"
        description="Suchleisten, Select-Akzent und Standard-Inputs."
        sources={[
          "lib/ui/module-search-filter-toolbar.ts",
          "lib/ui/app-select-trigger-accent.ts",
          "components/ui/input.tsx",
        ]}
      >
        <SampleRow label="Modul-Toolbar — Suche + Filter">
          <div className={moduleSearchFilterRowClassName}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                placeholder="Suchen …"
                className={moduleSearchInputClassName}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={moduleSearchFilterButtonClassName}
              aria-label="Filter"
            >
              <Filter className="size-4" />
            </Button>
          </div>
        </SampleRow>
        <SampleRow label="Select — Akzent-Ring (geöffnet / Fokus)">
          <Select defaultValue="2026">
            <SelectTrigger
              className={appSelectTriggerAccentCn("h-9 w-full max-w-xs")}
            >
              <SelectValue placeholder="Jahr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </SampleRow>
        <SampleRow label="Standard-Input">
          <Input placeholder="Textfeld" className="max-w-md rounded-xl" />
        </SampleRow>
      </DesignSection>

      <DesignSection
        id="lists"
        title="Listen & KPI"
        description="Paginierte Tabellen und KPI-Zähler in Modulen."
        sources={[
          "components/ui/list-pagination.tsx",
          "components/ui/kpi-card.tsx",
        ]}
      >
        <SampleRow label="KPI-Karte">
          <div className="max-w-xs">
            <KpiCard
              label="Offene Aufgaben"
              value="7"
              hint="Heute fällig"
              icon={TrendingUp}
            />
          </div>
        </SampleRow>
        <SampleRow label="ListPagination — x/y · Seite n/m">
          <ListPagination
            placement="above"
            page={2}
            totalPages={5}
            shown={12}
            totalCount={45}
            itemLabel="Einträge"
            canPrevious
            canNext
            onPrevious={() => {}}
            onNext={() => {}}
            className="rounded-xl border border-border/50 bg-card px-4 py-3"
          />
        </SampleRow>
      </DesignSection>

      <DesignSection
        id="badges"
        title="Badges & Status"
        description="shadcn-Badges und domänenspezifische Prioritäts-Farben."
        sources={[
          "components/ui/badge.tsx",
          "lib/staff/staff-todo-status.ts",
        ]}
      >
        <SampleRow label="shadcn — Varianten">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </SampleRow>
        <SampleRow label="Checkliste — Priorität">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={staffTodoPriorityBadgeClass("high")}
            >
              Hoch
            </Badge>
            <Badge
              variant="outline"
              className={staffTodoPriorityBadgeClass("medium")}
            >
              Mittel
            </Badge>
            <Badge
              variant="outline"
              className={staffTodoPriorityBadgeClass("low")}
            >
              Niedrig
            </Badge>
          </div>
        </SampleRow>
      </DesignSection>

      <DesignSection
        id="loading"
        title="Ladezustände"
        description="Akzent-Shimmer — nur bei echtem Remote-Laden, mit useDeferredSkeleton."
        sources={[
          "components/ui/skeleton.tsx",
          "lib/hooks/use-deferred-skeleton.ts",
        ]}
      >
        <SampleRow label="SkeletonCardFrame + Shimmer">
          <SkeletonCardFrame className="space-y-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </SkeletonCardFrame>
        </SampleRow>
      </DesignSection>

      <DesignSection
        id="integrations"
        title="Integrations-Karten"
        description="Plattform-Akzentfarben für Hover-Border in Superadmin Integrationen."
        sources={["lib/ui/integration-panel-accent.ts"]}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            Object.entries(INTEGRATION_PANEL_ACCENT) as Array<
              [keyof typeof INTEGRATION_PANEL_ACCENT, string]
            >
          ).map(([key, color]) => (
            <div
              key={key}
              className="rounded-xl border bg-card p-4 shadow-card transition-colors"
              style={{ borderColor: integrationPanelAccentBorderColor(color) }}
            >
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {key.replace(/_/g, " ")}
              </p>
              <p
                className="mt-1 font-mono text-sm font-semibold tabular-nums"
                style={{ color }}
              >
                {color}
              </p>
            </div>
          ))}
        </div>
      </DesignSection>
    </div>
  );
}
