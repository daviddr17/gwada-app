"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, MessageSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ContactEditDrawer } from "@/components/contacts/contact-edit-drawer";
import { ContactMessagesDrawer } from "@/components/contacts/contact-messages-drawer";
import { ContactReservationsDrawer } from "@/components/contacts/contact-reservations-drawer";
import {
  channelCellLabel,
  contactAddressLabel,
  contactDisplayName,
  emailsForCell,
  fetchContactReservationsQuick,
  fetchContactsForRestaurant,
  phonesForCell,
  type ContactListRow,
  type ContactReservationLink,
} from "@/lib/supabase/contacts-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { resolveCountryIso2FromLabel } from "@/lib/constants/countries";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SortKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "address"
  | "lastInteraction";
type SortDir = "asc" | "desc";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground transition-colors normal-case",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        <span className="text-foreground" aria-hidden>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  );
}

function ChannelCell({ values }: { values: string[] }) {
  const { primary, extra } = channelCellLabel(values);
  return (
    <span className="block min-w-0">
      <span className="block truncate" title={primary}>
        {primary}
      </span>
      {extra > 0 ? (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          +{extra} weitere
        </span>
      ) : null}
    </span>
  );
}

export function ContactsOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactParam = searchParams.get("contact");
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const { profile } = useRestaurantProfile();
  const defaultCountryIso2 = useMemo(
    () => resolveCountryIso2FromLabel(profile.country),
    [profile.country],
  );

  const [rows, setRows] = useState<ContactListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("lastInteraction");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [linksDrawer, setLinksDrawer] = useState<{
    id: string;
    name: string;
    reservations: ContactReservationLink[];
  } | null>(null);
  const [linksLoading, setLinksLoading] = useState(false);
  const [messagesDrawer, setMessagesDrawer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await fetchContactsForRestaurant(restaurantId);
    setLoading(false);
    if (error) toast.error(error.message);
    else setRows(data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!contactParam) return;
    setEditContactId(contactParam);
    setDrawerOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("contact");
    const q = p.toString();
    router.replace(q ? `/kontakte/uebersicht?${q}` : "/kontakte/uebersicht");
  }, [contactParam, router, searchParams]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    let list = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.first_name,
          r.last_name,
          r.company ?? "",
          ...emailsForCell(r),
          ...phonesForCell(r),
          contactAddressLabel(r),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (!sortKey) return list;
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "firstName":
          return a.first_name.localeCompare(b.first_name, "de") * dir;
        case "lastName":
          return a.last_name.localeCompare(b.last_name, "de") * dir;
        case "email":
          return (
            (emailsForCell(a)[0] ?? "").localeCompare(
              emailsForCell(b)[0] ?? "",
              "de",
            ) * dir
          );
        case "phone":
          return (
            (phonesForCell(a)[0] ?? "").localeCompare(
              phonesForCell(b)[0] ?? "",
              "de",
            ) * dir
          );
        case "address":
          return contactAddressLabel(a).localeCompare(
            contactAddressLabel(b),
            "de",
          ) * dir;
        case "lastInteraction": {
          const ta = a.last_interaction_at
            ? new Date(a.last_interaction_at).getTime()
            : 0;
          const tb = b.last_interaction_at
            ? new Date(b.last_interaction_at).getTime()
            : 0;
          return (ta - tb) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [rows, search, sortKey, sortDir]);

  const openCreate = () => {
    setEditContactId(null);
    setDrawerOpen(true);
  };

  const openEdit = (id: string) => {
    setEditContactId(id);
    setDrawerOpen(true);
  };

  const openMessagesLink = (row: ContactListRow, e: MouseEvent) => {
    e.stopPropagation();
    if (row.message_count === 0) return;
    setMessagesDrawer({
      id: row.id,
      name: contactDisplayName(row),
    });
  };

  const openReservationsLink = (row: ContactListRow, e: MouseEvent) => {
    e.stopPropagation();
    if (!restaurantId || row.reservation_count === 0) return;
    setLinksLoading(true);
    setLinksDrawer({
      id: row.id,
      name: contactDisplayName(row),
      reservations: [],
    });
    void (async () => {
      const { data, error } = await fetchContactReservationsQuick(
        restaurantId,
        row.id,
      );
      setLinksLoading(false);
      if (error) {
        toast.error(error.message);
        setLinksDrawer(null);
        return;
      }
      setLinksDrawer({
        id: row.id,
        name: contactDisplayName(row),
        reservations: data,
      });
    })();
  };

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nachname, Vorname, E-Mail, Telefon, Adresse …"
                className="h-10 rounded-xl pl-9"
                aria-label="Kontakte durchsuchen"
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {filteredSorted.length} Kontakt
                {filteredSorted.length === 1 ? "" : "e"}
              </span>
              <Button
                type="button"
                className="h-10 shrink-0 gap-2 rounded-xl"
                onClick={openCreate}
              >
                <Plus className="size-4" />
                Neuer Kontakt
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="min-w-[7rem] px-2 py-2 text-left">
                    <SortHeader
                      label="Nachname"
                      sortKey="lastName"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[7rem] px-2 py-2 text-left">
                    <SortHeader
                      label="Vorname"
                      sortKey="firstName"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[10rem] px-2 py-2 text-left">
                    <SortHeader
                      label="E-Mail"
                      sortKey="email"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[9rem] px-2 py-2 text-left">
                    <SortHeader
                      label="Telefon"
                      sortKey="phone"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[12rem] px-2 py-2 text-left">
                    <SortHeader
                      label="Adresse"
                      sortKey="address"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[6.5rem] px-2 py-2 text-left hidden xl:table-cell">
                    <SortHeader
                      label="Zuletzt"
                      sortKey="lastInteraction"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th
                    className="w-14 px-1 py-2 text-center"
                    title="Reservierungen"
                  >
                    <CalendarDays
                      className="mx-auto size-3.5 opacity-70"
                      aria-hidden
                    />
                  </th>
                  <th
                    className="w-14 px-1 py-2 text-center"
                    title="Nachrichten"
                  >
                    <MessageSquare
                      className="mx-auto size-3.5 opacity-70"
                      aria-hidden
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Laden …
                    </td>
                  </tr>
                ) : filteredSorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      {search.trim()
                        ? "Keine Treffer für die Suche."
                        : "Noch keine Kontakte — lege einen an oder speichere eine Reservierung mit E-Mail/Telefon."}
                    </td>
                  </tr>
                ) : (
                  filteredSorted.map((r) => {
                    const addr = contactAddressLabel(r);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/25 cursor-pointer transition-colors"
                        onClick={() => openEdit(r.id)}
                      >
                        <td className="px-2 py-2 align-middle font-medium">
                          {r.last_name || "—"}
                          {r.company ? (
                            <span
                              className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground max-w-[8rem]"
                              title={r.company}
                            >
                              {r.company}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          {r.first_name || "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-muted-foreground">
                          <ChannelCell values={emailsForCell(r)} />
                        </td>
                        <td className="px-2 py-2 align-middle text-muted-foreground tabular-nums">
                          <ChannelCell values={phonesForCell(r)} />
                        </td>
                        <td
                          className="px-2 py-2 align-middle text-muted-foreground max-w-[14rem]"
                          title={addr}
                        >
                          <span className="block truncate">{addr}</span>
                        </td>
                        <td className="px-2 py-2 align-middle text-xs text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                          {formatWhen(r.last_interaction_at)}
                        </td>
                        <td
                          className="px-1 py-2 align-middle text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                              "relative text-muted-foreground hover:text-foreground",
                              r.reservation_count === 0 &&
                                "opacity-40 pointer-events-none",
                            )}
                            aria-label={`${r.reservation_count} Reservierung(en)`}
                            disabled={
                              r.reservation_count === 0 ||
                              (linksLoading &&
                                linksDrawer?.id === r.id)
                            }
                            onClick={(e) => openReservationsLink(r, e)}
                          >
                            <CalendarDays className="size-4" />
                            {r.reservation_count > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                                {r.reservation_count > 9
                                  ? "9+"
                                  : r.reservation_count}
                              </span>
                            ) : null}
                          </Button>
                        </td>
                        <td
                          className="px-1 py-2 align-middle text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                              "relative text-muted-foreground hover:text-foreground",
                              r.message_count === 0 &&
                                "opacity-40 pointer-events-none",
                            )}
                            aria-label={`${r.message_count} Nachricht(en)`}
                            disabled={r.message_count === 0}
                            onClick={(e) => openMessagesLink(r, e)}
                          >
                            <MessageSquare className="size-4" />
                            {r.message_count > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                                {r.message_count > 9
                                  ? "9+"
                                  : r.message_count}
                              </span>
                            ) : null}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ContactEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        contactId={editContactId}
        restaurantId={restaurantId}
        defaultCountryIso2={defaultCountryIso2}
        onSaved={() => void reload()}
      />

      <ContactReservationsDrawer
        open={linksDrawer !== null}
        onOpenChange={(o) => {
          if (!o) setLinksDrawer(null);
        }}
        contactName={linksDrawer?.name ?? ""}
        reservations={linksDrawer?.reservations ?? []}
      />

      {restaurantId && messagesDrawer ? (
        <ContactMessagesDrawer
          open={messagesDrawer !== null}
          onOpenChange={(o) => {
            if (!o) setMessagesDrawer(null);
          }}
          restaurantId={restaurantId}
          contactId={messagesDrawer.id}
          contactName={messagesDrawer.name}
        />
      ) : null}
    </>
  );
}
