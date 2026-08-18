"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { EventPackageDrawer } from "@/components/events/event-package-drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EVENT_PACKAGE_KIND_LABELS,
  EVENT_PACKAGE_KINDS,
  type EventPackage,
  type EventPackageKind,
  type EventPackageWriteFields,
} from "@/lib/events/event-package";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";

function packagesByKind(packages: EventPackage[]) {
  const groups: Record<EventPackageKind, EventPackage[]> = {
    buffet: [],
    drinks: [],
    extra: [],
  };
  for (const pkg of packages) groups[pkg.kind].push(pkg);
  return groups;
}

export function EventsPackagesSettings({ restaurantId }: { restaurantId: string }) {
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [packages, setPackages] = useState<EventPackage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EventPackage | null>(null);
  const [pending, setPending] = useState(false);

  const fetchPackages = useCallback(async () => {
    const params = new URLSearchParams({ restaurantId });
    const res = await fetch(`/api/events/packages?${params}`);
    const data = (await res.json().catch(() => ({}))) as {
      packages?: EventPackage[];
    };
    if (!res.ok) return null;
    return data.packages ?? [];
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = await fetchPackages();
      if (cancelled) return;
      if (next == null) {
        toast.error("Pakete konnten nicht geladen werden.");
        setPackages([]);
      } else {
        setPackages(next);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPackages]);

  const grouped = useMemo(() => packagesByKind(packages), [packages]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (pkg: EventPackage) => {
    setEditing(pkg);
    setDrawerOpen(true);
  };

  const save = async (input: EventPackageWriteFields) => {
    setPending(true);
    try {
      const res = editing
        ? await fetch(`/api/events/packages/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, ...input }),
          })
        : await fetch("/api/events/packages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, ...input }),
          });
      if (!res.ok) {
        toast.error("Paket konnte nicht gespeichert werden.");
        return;
      }
      toast.success(editing ? "Paket gespeichert." : "Paket angelegt.");
      setDrawerOpen(false);
      setEditing(null);
      const next = await fetchPackages();
      if (next) setPackages(next);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setPending(true);
    try {
      const params = new URLSearchParams({ restaurantId });
      const res = await fetch(`/api/events/packages/${editing.id}?${params}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Paket konnte nicht gelöscht werden.");
        return;
      }
      toast.success("Paket gelöscht.");
      setDrawerOpen(false);
      setEditing(null);
      const next = await fetchPackages();
      if (next) setPackages(next);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
      <div>
        <h2 className="text-base font-semibold">Anfrage-Pakete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Buffet, Getränke und Extras mit Preis pro Person. Gäste wählen sie im
          Anfrageformular — daraus entsteht ein Gwada-Angebot am Vorgang.
        </p>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : loading ? (
        <div className="min-h-[4.5rem]" aria-busy />
      ) : (
        <>
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={openCreate}
          >
            <Plus className="size-4" />
            Neues Paket
          </Button>

          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Pakete. Ohne Pakete bleibt das Anfrageformular frei — ohne
              Kalkulator.
            </p>
          ) : (
            <div className="space-y-4">
              {EVENT_PACKAGE_KINDS.map((kind) => {
                const rows = grouped[kind];
                if (rows.length === 0) return null;
                return (
                  <div key={kind} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {EVENT_PACKAGE_KIND_LABELS[kind]}
                    </p>
                    <ul className="space-y-1">
                      {rows.map((pkg) => {
                        const isActive = drawerOpen && editing?.id === pkg.id;
                        return (
                          <li key={pkg.id}>
                            <button
                              type="button"
                              onClick={() => openEdit(pkg)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-xl border border-border/50 px-3 py-3 text-left text-sm shadow-card transition-colors",
                                isActive
                                  ? "border-accent/40 bg-accent/5"
                                  : "hover:bg-muted/40",
                                !pkg.active && "opacity-70",
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {pkg.name}
                                </span>
                                {pkg.description ? (
                                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {pkg.description}
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-right text-sm tabular-nums">
                                {formatMenuPrice(pkg.pricePerPerson)}
                                <span className="block text-xs text-muted-foreground">
                                  {pkg.active ? "/ Person" : "ausgeblendet"}
                                </span>
                              </span>
                              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <EventPackageDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        pending={pending}
        pkg={editing}
        onSave={(input) => void save(input)}
        onDelete={editing ? () => void remove() : undefined}
      />
    </section>
  );
}
