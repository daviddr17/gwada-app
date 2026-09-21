"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { EventMenuDrawer } from "@/components/events/event-menu-drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  eventMenuPartyRangeLabel,
  type EventMenu,
  type EventMenuWriteFields,
} from "@/lib/events/event-menu";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";

export function EventsMenusSettings({ restaurantId }: { restaurantId: string }) {
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [menus, setMenus] = useState<EventMenu[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EventMenu | null>(null);
  const [pending, setPending] = useState(false);

  const fetchMenus = useCallback(async () => {
    const params = new URLSearchParams({ restaurantId });
    const res = await fetch(`/api/events/menus?${params}`);
    const data = (await res.json().catch(() => ({}))) as { menus?: EventMenu[] };
    if (!res.ok) return null;
    return data.menus ?? [];
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = await fetchMenus();
      if (cancelled) return;
      if (next == null) {
        toast.error("Menüs konnten nicht geladen werden.");
        setMenus([]);
      } else {
        setMenus(next);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMenus]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (menu: EventMenu) => {
    setEditing(menu);
    setDrawerOpen(true);
  };

  const save = async (input: EventMenuWriteFields) => {
    setPending(true);
    try {
      const res = editing
        ? await fetch(`/api/events/menus/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, ...input }),
          })
        : await fetch("/api/events/menus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, ...input }),
          });
      if (!res.ok) {
        toast.error("Menü konnte nicht gespeichert werden.");
        return;
      }
      toast.success(editing ? "Menü gespeichert." : "Menü angelegt.");
      setDrawerOpen(false);
      setEditing(null);
      const next = await fetchMenus();
      if (next) setMenus(next);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setPending(true);
    try {
      const params = new URLSearchParams({ restaurantId });
      const res = await fetch(`/api/events/menus/${editing.id}?${params}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Menü konnte nicht gelöscht werden.");
        return;
      }
      toast.success("Menü gelöscht.");
      setDrawerOpen(false);
      setEditing(null);
      const next = await fetchMenus();
      if (next) setMenus(next);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
      <div>
        <h2 className="text-base font-semibold">Menüvorschläge</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gänge und Gerichte, die Gäste im Anfrageformular zusammenstellen —
          inkl. Personenanzahl, Kinderpreis und Wünsche.
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
            Neues Menü
          </Button>

          {menus.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Menüs. Ohne Vorschläge wählen Gäste nur Buffet, Getränke
              und Extras — oder schreiben ihre Wünsche frei.
            </p>
          ) : (
            <ul className="space-y-1">
              {menus.map((menu) => {
                const isActive = drawerOpen && editing?.id === menu.id;
                const range = eventMenuPartyRangeLabel(menu);
                const courseCount = menu.courses.length;
                return (
                  <li key={menu.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(menu)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border border-border/50 px-3 py-3 text-left text-sm shadow-card transition-colors",
                        isActive
                          ? "border-accent/40 bg-accent/5"
                          : "hover:bg-muted/40",
                        !menu.active && "opacity-70",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {menu.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[
                            courseCount > 0
                              ? `${courseCount} ${courseCount === 1 ? "Gang" : "Gänge"}`
                              : "ohne Gänge",
                            range,
                            menu.description || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums">
                        {formatMenuPrice(menu.pricePerPerson)}
                        <span className="block text-xs text-muted-foreground">
                          {menu.active ? "/ Person" : "ausgeblendet"}
                        </span>
                      </span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <EventMenuDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        pending={pending}
        menu={editing}
        onSave={(input) => void save(input)}
        onDelete={editing ? () => void remove() : undefined}
      />
    </section>
  );
}
