"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, MessageSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleDataTableHeadLabelClassName,
  moduleDataTableHeadRowClassName,
  moduleDataTableHeadSortButtonCn,
  moduleTableFullscreenChromeInsetDenseClassName,
} from "@/lib/ui/module-data-table";
import {
  ModuleTableActionsCell,
  ModuleTableIconActionButton,
  ModuleTableIconActionsColumnHeader,
} from "@/lib/ui/module-table-icon-tooltip";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ContactCatalogFilterChips } from "@/components/contacts/contact-catalog-filter-chips";
import { ContactEditDrawer } from "@/components/contacts/contact-edit-drawer";
import { ContactMessagesDrawer } from "@/components/contacts/contact-messages-drawer";
import { ContactPlatformBadges } from "@/components/contacts/contact-platform-badges";
import { ContactReservationsDrawer } from "@/components/contacts/contact-reservations-drawer";
import {
  channelCellLabel,
  contactOverviewFirstName,
  contactOverviewLastName,
  fetchContactReservationsQuick,
  type ContactReservationLink,
} from "@/lib/supabase/contacts-db";
import {
  CONTACT_CATALOG_FILTER_ALL,
  parseContactCatalogPlatformFilter,
  type ContactCatalogPlatform,
  type ContactCatalogPlatformFilter,
} from "@/lib/constants/contact-catalog-platforms";
import type { ContactCreateDraft } from "@/lib/contact-messages/draft-from-waha-chat";
import {
  filterUnifiedContactsByPlatform,
  unifiedContactAddressLabel,
  unifiedContactDisplayName,
  type UnifiedContactListRow,
} from "@/lib/contacts/unified-contact-row";
import { useLexofficeContactIntegration } from "@/lib/hooks/use-lexoffice-contact-integration";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead, hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { resolveCountryIso2FromLabel } from "@/lib/constants/countries";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SortKey =
  | "firstName"
  | "lastName"
  | "company"
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
      className={cn(moduleDataTableHeadSortButtonCn(active), "normal-case", className)}
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
  const platformParam = searchParams.get("platform");
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "contacts");
  const lexoffice = useLexofficeContactIntegration(restaurantId);
  const { profile } = useRestaurantProfile();
  const defaultCountryIso2 = useMemo(
    () => resolveCountryIso2FromLabel(profile.country),
    [profile.country],
  );

  const [rows, setRows] = useState<UnifiedContactListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lexofficeError, setLexofficeError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<ContactCatalogPlatformFilter>(
    () => parseContactCatalogPlatformFilter(platformParam),
  );
  const [createDraft, setCreateDraft] = useState<ContactCreateDraft | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("lastInteraction");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
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
    try {
      const res = await fetch(
        `/api/contacts/unified?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        items?: UnifiedContactListRow[];
        lexofficeError?: string | null;
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Kontakte konnten nicht geladen werden.");
        setRows([]);
      } else {
        setRows(body.items ?? []);
        setLexofficeError(body.lexofficeError ?? null);
      }
    } catch {
      toast.error("Netzwerkfehler beim Laden der Kontakte.");
      setRows([]);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPlatformFilter(parseContactCatalogPlatformFilter(platformParam));
  }, [platformParam]);

  const selectPlatformFilter = useCallback(
    (next: ContactCatalogPlatformFilter) => {
      setPlatformFilter(next);
      const p = new URLSearchParams(searchParams.toString());
      if (next === CONTACT_CATALOG_FILTER_ALL) p.delete("platform");
      else p.set("platform", next);
      const q = p.toString();
      router.replace(
        q ? `/dashboard/kontakte/uebersicht?${q}` : "/dashboard/kontakte/uebersicht",
      );
    },
    [router, searchParams],
  );

  const isPlatformAvailable = useCallback(
    (p: ContactCatalogPlatform) => {
      if (p === "gwada") return true;
      return lexoffice.connected;
    },
    [lexoffice.connected],
  );

  useEffect(() => {
    if (!contactParam) return;
    setEditContactId(contactParam);
    setDrawerOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("contact");
    const q = p.toString();
    router.replace(q ? `/dashboard/kontakte/uebersicht?${q}` : "/dashboard/kontakte/uebersicht");
  }, [contactParam, router, searchParams]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setCreateDraft(null);
    setEditContactId(null);
    setDrawerOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    const q = p.toString();
    router.replace(
      q ? `/dashboard/kontakte/uebersicht?${q}` : "/dashboard/kontakte/uebersicht",
      { scroll: false },
    );
  }, [searchParams, router]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    let list = filterUnifiedContactsByPlatform(rows, platformFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.first_name,
          r.last_name,
          r.company ?? "",
          ...r.emails,
          ...r.phones,
          unifiedContactAddressLabel(r),
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
        case "company":
          return (a.company ?? "").localeCompare(b.company ?? "", "de") * dir;
        case "email":
          return (
            (a.emails[0] ?? "").localeCompare(b.emails[0] ?? "", "de") * dir
          );
        case "phone":
          return (
            (a.phones[0] ?? "").localeCompare(b.phones[0] ?? "", "de") * dir
          );
        case "address":
          return unifiedContactAddressLabel(a).localeCompare(
            unifiedContactAddressLabel(b),
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
  }, [rows, search, sortKey, sortDir, platformFilter]);

  const totalCount = filteredSorted.length;
  const totalPages = totalPagesFromCount(totalCount, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filteredSorted.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [filteredSorted, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search, platformFilter]);

  const openCreate = () => {
    setCreateDraft(null);
    setEditContactId(null);
    setDrawerOpen(true);
  };

  const openEdit = (id: string) => {
    setCreateDraft(null);
    setEditContactId(id);
    setDrawerOpen(true);
  };

  const openRow = (row: UnifiedContactListRow) => {
    if (row.gwadaContactId) {
      openEdit(row.gwadaContactId);
      return;
    }
    setCreateDraft({
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company ?? undefined,
      addressStreet: row.address_street ?? undefined,
      addressPostalCode: row.address_postal_code ?? undefined,
      addressCity: row.address_city ?? undefined,
      addressCountry: row.address_country ?? undefined,
      notes: row.notes ?? undefined,
      emails: row.emails.map((email) => ({ email })),
      phones: row.phones.map((phone) => ({
        iso2: defaultCountryIso2,
        local: phone,
      })),
      linkExistingLexofficeId: row.lexofficeContactId,
    });
    setEditContactId(null);
    setDrawerOpen(true);
  };

  const openMessagesLink = (row: UnifiedContactListRow, e: MouseEvent) => {
    e.stopPropagation();
    if (!row.gwadaContactId || row.message_count === 0) return;
    setMessagesDrawer({
      id: row.gwadaContactId,
      name: unifiedContactDisplayName(row),
    });
  };

  const openReservationsLink = (row: UnifiedContactListRow, e: MouseEvent) => {
    e.stopPropagation();
    if (!restaurantId || !row.gwadaContactId || row.reservation_count === 0) return;
    setLinksLoading(true);
    setLinksDrawer({
      id: row.gwadaContactId,
      name: unifiedContactDisplayName(row),
      reservations: [],
    });
    void (async () => {
      const { data, error } = await fetchContactReservationsQuick(
        restaurantId,
        row.gwadaContactId!,
      );
      setLinksLoading(false);
      if (error) {
        toast.error(error.message);
        setLinksDrawer(null);
        return;
      }
      setLinksDrawer({
        id: row.gwadaContactId!,
        name: unifiedContactDisplayName(row),
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

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Nachrichten" />;
  }

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-4">
          {lexoffice.platformEnabled ? (
            <ContactCatalogFilterChips
              filter={platformFilter}
              onFilterChange={selectPlatformFilter}
              isPlatformAvailable={isPlatformAvailable}
              disabled={loading || lexoffice.loading}
            />
          ) : null}

          <div className="space-y-3">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nachname, Vorname, Firma, E-Mail, Telefon, Adresse …"
                className="h-10 w-full rounded-xl pl-9"
                aria-label="Kontakte durchsuchen"
              />
            </div>
            <Button
              type="button"
              size="lg"
              className={modulePrimaryAddButtonFullWidthClassName}
              onClick={openCreate}
            >
              <Plus className="size-4" />
              Neuer Kontakt
            </Button>
          </div>

          {lexofficeError ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Lexware-Kontakte konnten nicht geladen werden: {lexofficeError}
            </p>
          ) : null}

          <ModulePaginatedDataTable
            page={currentPage}
            totalPages={totalPages}
            shown={paginatedRows.length}
            totalCount={totalCount}
            itemLabel="Kontakte"
            fullscreenChromeInsetClassName={
              moduleTableFullscreenChromeInsetDenseClassName
            }
            canPrevious={currentPage > 1}
            canNext={currentPage < totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className={moduleDataTableHeadRowClassName}>
                  <th className="w-16 px-2 py-2 text-left">
                    <span className={moduleDataTableHeadLabelClassName}>
                      Quelle
                    </span>
                  </th>
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
                  <th className="min-w-[9rem] px-2 py-2 text-left">
                    <SortHeader
                      label="Firmenname"
                      sortKey="company"
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
                  <ModuleTableIconActionsColumnHeader
                    dense
                    className="min-w-[5.5rem] w-[5.5rem]"
                  />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Laden …
                    </td>
                  </tr>
                ) : filteredSorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      {search.trim()
                        ? "Keine Treffer für die Suche."
                        : "Noch keine Kontakte — lege einen an oder speichere eine Reservierung mit E-Mail/Telefon."}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r) => {
                    const addr = unifiedContactAddressLabel(r);
                    return (
                      <tr
                        key={r.rowKey}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/25 cursor-pointer transition-colors"
                        onClick={() => openRow(r)}
                      >
                        <td className="px-2 py-2 align-middle">
                          <ContactPlatformBadges platforms={r.platforms} />
                        </td>
                        <td className="px-2 py-2 align-middle font-medium">
                          {contactOverviewLastName(r)}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          {contactOverviewFirstName(r)}
                        </td>
                        <td
                          className="px-2 py-2 align-middle text-muted-foreground max-w-[12rem]"
                          title={r.company ?? undefined}
                        >
                          <span className="block truncate">
                            {r.company?.trim() || "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-middle text-muted-foreground">
                          <ChannelCell values={r.emails} />
                        </td>
                        <td className="px-2 py-2 align-middle text-muted-foreground tabular-nums">
                          <ChannelCell values={r.phones} />
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
                        <ModuleTableActionsCell
                          dense
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ModuleTableIconActionButton
                            label={
                              r.reservation_count === 0
                                ? "Keine Reservierungen"
                                : `${r.reservation_count} Reservierung(en)`
                            }
                            className={cn(
                              "relative text-muted-foreground hover:text-foreground",
                              r.reservation_count === 0 && "opacity-40",
                            )}
                            disabled={
                              r.reservation_count === 0 ||
                              (linksLoading &&
                                linksDrawer?.id === r.gwadaContactId)
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
                          </ModuleTableIconActionButton>
                          <ModuleTableIconActionButton
                            label={
                              r.message_count === 0
                                ? "Keine Nachrichten"
                                : `${r.message_count} Nachricht(en)`
                            }
                            className={cn(
                              "relative text-muted-foreground hover:text-foreground",
                              r.message_count === 0 && "opacity-40",
                            )}
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
                          </ModuleTableIconActionButton>
                        </ModuleTableActionsCell>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </ModulePaginatedDataTable>
        </CardContent>
      </Card>

      <ContactEditDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setCreateDraft(null);
        }}
        contactId={editContactId}
        restaurantId={restaurantId}
        defaultCountryIso2={defaultCountryIso2}
        initialDraft={createDraft}
        lexofficeConnected={lexoffice.connected}
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
