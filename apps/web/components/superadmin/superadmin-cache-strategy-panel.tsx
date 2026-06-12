"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleDot,
  Filter,
  Layers,
  Workflow,
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
import {
  DASHBOARD_LOAD_FLOW_STEP_IDS,
  MODULE_CACHE_DECISION_GUIDE,
  MODULE_CACHE_STRATEGY_META,
  listModuleCachePolicies,
  type ModuleCachePolicyEntry,
  type ModuleCachePolicyStatus,
  type ModuleCacheScope,
  type ModuleCacheStrategy,
} from "@/lib/dashboard/module-data-cache-policy";
import { cn } from "@/lib/utils";

function StrategyBadge({ strategy }: { strategy: ModuleCacheStrategy }) {
  const meta = MODULE_CACHE_STRATEGY_META[strategy];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.colorClass,
      )}
    >
      {meta.shortLabel}
    </span>
  );
}

function StatusBadge({ status }: { status: ModuleCachePolicyStatus }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
        aktiv
      </Badge>
    );
  }
  if (status === "planned") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200">
        geplant
      </Badge>
    );
  }
  return <Badge variant="outline">legacy</Badge>;
}

function TimingPills({ entry }: { entry: ModuleCachePolicyEntry }) {
  const items: string[] = [];
  if (entry.staleTimeMs != null) {
    items.push(`stale ${Math.round(entry.staleTimeMs / 1000)}s`);
  }
  if (entry.pollIntervalMs != null) {
    items.push(`poll ${Math.round(entry.pollIntervalMs / 1000)}s`);
  }
  if (entry.gcTimeMs != null) {
    items.push(`gc ${Math.round(entry.gcTimeMs / 60_000)}min`);
  }
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function FlowStepCard({ entry }: { entry: ModuleCachePolicyEntry }) {
  return (
    <div className="flex min-w-[9.5rem] max-w-[11rem] shrink-0 flex-col gap-2 rounded-xl border border-border/50 bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug text-foreground">
          {entry.label}
        </p>
        <StrategyBadge strategy={entry.strategy} />
      </div>
      <TimingPills entry={entry} />
      <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
        {entry.loadTriggers[0]}
      </p>
    </div>
  );
}

function PolicyCard({ entry }: { entry: ModuleCachePolicyEntry }) {
  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{entry.label}</CardTitle>
          <StrategyBadge strategy={entry.strategy} />
          <StatusBadge status={entry.status} />
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {entry.description}
        </CardDescription>
        {entry.appModule ? (
          <p className="text-xs text-muted-foreground">
            Modul: <span className="font-medium text-foreground">{entry.appModule}</span>
            {" · "}
            Bereich: {entry.scope}
          </p>
        ) : null}
        <TimingPills entry={entry} />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Laden
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
            {entry.loadTriggers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Invalidierung / Refresh
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
            {entry.invalidateTriggers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        {entry.apiEndpoints?.length ? (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              APIs
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.apiEndpoints.map((api) => (
                <code
                  key={api}
                  className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px]"
                >
                  {api}
                </code>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Code
          </p>
          <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
            {entry.implementationFiles.map((file) => (
              <p key={file} className="break-all">
                {file}
              </p>
            ))}
          </div>
        </div>
        {entry.notes ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            {entry.notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const SCOPE_LABELS: Record<ModuleCacheScope, string> = {
  dashboard: "Dashboard",
  chrome: "App-Chrome",
  module: "Module",
  platform: "Plattform",
};

export function SuperadminCacheStrategyPanel() {
  const policies = useMemo(() => listModuleCachePolicies(), []);
  const [scopeFilter, setScopeFilter] = useState<ModuleCacheScope | "all">("all");
  const [strategyFilter, setStrategyFilter] = useState<ModuleCacheStrategy | "all">(
    "all",
  );

  const flowSteps = useMemo(
    () =>
      DASHBOARD_LOAD_FLOW_STEP_IDS.map((id) =>
        policies.find((p) => p.id === id),
      ).filter((p): p is ModuleCachePolicyEntry => Boolean(p)),
    [policies],
  );

  const filtered = useMemo(() => {
    return policies.filter((entry) => {
      if (scopeFilter !== "all" && entry.scope !== scopeFilter) return false;
      if (strategyFilter !== "all" && entry.strategy !== strategyFilter) return false;
      return true;
    });
  }, [policies, scopeFilter, strategyFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleCachePolicyEntry[]>();
    for (const entry of filtered) {
      const key = entry.appModule ?? SCOPE_LABELS[entry.scope];
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "de"));
  }, [filtered]);

  return (
    <div className="space-y-8">
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-lg">So erweitert ihr Module</CardTitle>
          </div>
          <CardDescription className="leading-relaxed">
            Die Registry liegt in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              lib/dashboard/module-data-cache-policy.ts
            </code>
            . Neuen Eintrag anlegen, Konstanten aus der Policy beziehen, diese Seite
            zeigt den Stand automatisch — keine zweite Dokumentation pflegen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CACHE_DECISION_GUIDE.map((row) => (
            <div
              key={row.question}
              className="rounded-xl border border-border/50 bg-muted/30 p-4"
            >
              <p className="mb-2 text-sm font-medium text-foreground">
                {row.question}
              </p>
              <StrategyBadge strategy={row.recommendation} />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {row.hint}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight">
            Dashboard: Ladereihenfolge
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Beim Öffnen von <code className="font-mono text-xs">/dashboard</code> —
          von links nach rechts. Parallele Schritte starten unabhängig; spätere
          Schritte warten ggf. auf frühere (z. B. Inbox-Warm nach Batch).
        </p>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-stretch gap-2">
            {flowSteps.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-2">
                <FlowStepCard entry={entry} />
                {index < flowSteps.length - 1 ? (
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight">
            Strategien (Legende)
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            Object.entries(MODULE_CACHE_STRATEGY_META) as [
              ModuleCacheStrategy,
              (typeof MODULE_CACHE_STRATEGY_META)[ModuleCacheStrategy],
            ][]
          ).map(([key, meta]) => (
            <div
              key={key}
              className="rounded-xl border border-border/50 bg-card p-4 shadow-card"
            >
              <div className="mb-2">
                <StrategyBadge strategy={key} />
              </div>
              <p className="text-sm font-medium text-foreground">{meta.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {meta.whenToUse}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CircleDot className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight">
              Alle Datenbereiche
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-muted-foreground" aria-hidden />
            {(["all", "dashboard", "chrome", "module", "platform"] as const).map(
              (scope) => (
                <Button
                  key={scope}
                  type="button"
                  size="sm"
                  variant={scopeFilter === scope ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => setScopeFilter(scope)}
                >
                  {scope === "all" ? "Alle" : SCOPE_LABELS[scope]}
                </Button>
              ),
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={strategyFilter === "all" ? "secondary" : "outline"}
            className="rounded-full"
            onClick={() => setStrategyFilter("all")}
          >
            Alle Strategien
          </Button>
          {(
            Object.keys(MODULE_CACHE_STRATEGY_META) as ModuleCacheStrategy[]
          ).map((strategy) => (
            <Button
              key={strategy}
              type="button"
              size="sm"
              variant={strategyFilter === strategy ? "secondary" : "outline"}
              className="rounded-full"
              onClick={() => setStrategyFilter(strategy)}
            >
              {MODULE_CACHE_STRATEGY_META[strategy].shortLabel}
            </Button>
          ))}
        </div>

        <div className="space-y-8">
          {grouped.map(([group, entries]) => (
            <div key={group} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{group}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {entries.map((entry) => (
                  <PolicyCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
