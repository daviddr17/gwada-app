"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SuperadminDataTable } from "@/components/superadmin/superadmin-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import { superadminDateCellClass } from "@/components/superadmin/superadmin-table-cells";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyToClipboardButton } from "@/components/ui/copy-to-clipboard-button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOTIFICATION_MODULE_IDS } from "@/lib/notifications/notification-modules";
import {
  fetchSuperadminNotificationLog,
  formatNotificationLogDt,
  formatNotificationPayloadSummary,
  notificationChannelLabel,
  notificationDeliveryStatusLabel,
  notificationModuleLabel,
  recipientLabelForLogRow,
  restaurantLabelForLogRow,
  sourceTimestampFromPayload,
  type SuperadminNotificationLogRow,
} from "@/lib/superadmin/superadmin-notification-log";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "sent":
      return "border-emerald-500/40 bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-200";
    case "failed":
      return "border-destructive/40 bg-destructive/10 font-normal text-destructive";
    case "pending":
      return "border-amber-500/40 bg-amber-500/10 font-normal text-amber-900 dark:text-amber-100";
    case "processing":
      return "border-sky-500/40 bg-sky-500/10 font-normal text-sky-900 dark:text-sky-100";
    default:
      return "font-normal";
  }
}

function CopyableDetailBlock({
  label,
  value,
  copyLabel,
  mono,
}: {
  label: string;
  value: string;
  copyLabel?: string;
  mono?: boolean;
}) {
  const display = value || "—";
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-1">
        <p
          className={cn(
            "min-w-0 flex-1 text-sm break-all",
            mono && "font-mono text-xs",
          )}
        >
          {display}
        </p>
        {value ? (
          <CopyToClipboardButton
            value={value}
            label={copyLabel ?? label}
            className="mt-0.5"
          />
        ) : null}
      </div>
    </div>
  );
}

function DetailBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-sm break-all", mono && "font-mono text-xs")}>
        {value || "—"}
      </p>
    </div>
  );
}

export function SuperadminNotificationLogPanel() {
  const [rows, setRows] = useState<SuperadminNotificationLogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selected, setSelected] = useState<SuperadminNotificationLogRow | null>(
    null,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const sb = createSupabaseBrowserClient();
      const result = await fetchSuperadminNotificationLog(sb, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: debouncedSearch,
        module: moduleFilter,
        channel: channelFilter,
        status: statusFilter,
      });

      if (cancelled) return;
      if (result.error) toast.error(result.error);
      setRows(result.rows);
      setTotalCount(result.totalCount);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, moduleFilter, channelFilter, statusFilter, reloadNonce]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const reload = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const moduleOptions = useMemo(
    () => [
      { value: "all", label: "Alle Zwecke" },
      ...NOTIFICATION_MODULE_IDS.map((id) => ({
        value: id,
        label: notificationModuleLabel(id),
      })),
    ],
    [],
  );

  const channelOptions = useMemo(
    () => [
      { value: "all", label: "Alle Kanäle" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "email", label: "E-Mail" },
      { value: "none", label: "Kein Versand" },
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Alle Status" },
      { value: "sent", label: "Gesendet" },
      { value: "pending", label: "Ausstehend" },
      { value: "processing", label: "In Arbeit" },
      { value: "failed", label: "Fehlgeschlagen" },
      { value: "event_only", label: "Nur Event" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Push-Auslöser (Events) und Zustellungen (WhatsApp/E-Mail) aller
        Restaurants — serverseitig gefiltert und paginiert (50 pro Seite).
        Spalten: wann das Event angelegt wurde, wann versendet (falls
        zutreffend), und wann der auslösende Vorgang stattfand (z. B.
        Bewertungsdatum).
      </p>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <SuperadminSearchToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="E-Mail, Referenz, Restaurant, User-ID…"
          filterLabel="Zweck"
          filterValue={moduleFilter}
          filterOptions={moduleOptions}
          onFilterChange={(value) => {
            setModuleFilter(value);
            setPage(1);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={channelFilter}
            onValueChange={(value) => {
              setChannelFilter(String(value));
              setPage(1);
            }}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn("h-9 min-w-[9rem]")}
              aria-label="Kanal filtern"
            >
              <SelectValue>
                {channelOptions.find((o) => o.value === channelFilter)?.label ??
                  "Kanal"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {channelOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(String(value));
              setPage(1);
            }}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn("h-9 min-w-[9rem]")}
              aria-label="Status filtern"
            >
              <SelectValue>
                {statusOptions.find((o) => o.value === statusFilter)?.label ??
                  "Status"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => reload()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Aktualisieren
          </Button>
        </div>
      </div>

      <SuperadminDataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.delivery_id ?? `event:${r.event_id}`}
        emptyMessage={
          debouncedSearch || moduleFilter !== "all" || channelFilter !== "all" || statusFilter !== "all"
            ? "Keine Treffer für diese Filter."
            : "Keine Benachrichtigungen im Log."
        }
        columns={[
          {
            id: "event_at",
            header: "Event",
            className: superadminDateCellClass,
            sortValue: (r) => r.event_created_at,
            cell: (r) => (
              <button
                type="button"
                className={cn(superadminDateCellClass, "text-left hover:underline")}
                onClick={() => setSelected(r)}
              >
                {formatNotificationLogDt(r.event_created_at)}
              </button>
            ),
          },
          {
            id: "sent_at",
            header: "Versand",
            className: superadminDateCellClass,
            sortValue: (r) => r.sent_at ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatNotificationLogDt(r.sent_at)}
              </span>
            ),
          },
          {
            id: "source_at",
            header: "Quelle",
            className: superadminDateCellClass,
            sortValue: (r) =>
              sourceTimestampFromPayload(r.module, r.payload) ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatNotificationLogDt(
                  sourceTimestampFromPayload(r.module, r.payload),
                )}
              </span>
            ),
          },
          {
            id: "restaurant",
            header: "Restaurant",
            sortValue: (r) => restaurantLabelForLogRow(r),
            cell: (r) => restaurantLabelForLogRow(r),
          },
          {
            id: "module",
            header: "Zweck",
            sortValue: (r) => notificationModuleLabel(r.module),
            cell: (r) => (
              <Badge variant="outline" className="font-normal">
                {notificationModuleLabel(r.module)}
              </Badge>
            ),
          },
          {
            id: "recipient",
            header: "An wen",
            sortValue: (r) => recipientLabelForLogRow(r),
            cell: (r) => (
              <span className="block max-w-[14rem] truncate">
                {recipientLabelForLogRow(r)}
              </span>
            ),
          },
          {
            id: "channel",
            header: "Kanal",
            sortValue: (r) => r.channel ?? "",
            cell: (r) => notificationChannelLabel(r.channel),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (r) => r.delivery_status ?? r.row_kind,
            cell: (r) =>
              r.row_kind === "event_only" ? (
                <Badge variant="outline" className="font-normal">
                  Nur Event
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={statusBadgeClass(r.delivery_status)}
                >
                  {notificationDeliveryStatusLabel(r.delivery_status)}
                </Badge>
              ),
          },
          {
            id: "summary",
            header: "Inhalt (Kurz)",
            sortValue: (r) =>
              formatNotificationPayloadSummary(r.module, r.payload),
            cell: (r) => (
              <button
                type="button"
                className="max-w-[18rem] truncate text-left text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setSelected(r)}
              >
                {formatNotificationPayloadSummary(r.module, r.payload)}
              </button>
            ),
          },
          {
            id: "reference",
            header: "Referenz",
            sortValue: (r) => r.reference_id,
            cell: (r) => (
              <span className="font-mono text-xs text-muted-foreground">
                {r.reference_id}
              </span>
            ),
          },
        ]}
      />

      <ListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        itemLabel="Einträge"
        canPrevious={page > 1}
        canNext={page < totalPages}
        busy={loading}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />

      <Drawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(88dvh,640px)] max-w-3xl flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          {selected ? (
            <>
              <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
                <DrawerTitle className="text-xl font-semibold tracking-tight">
                  {notificationModuleLabel(selected.module)}
                </DrawerTitle>
                <DrawerDescription className="text-sm leading-relaxed">
                  {formatNotificationLogDt(selected.event_created_at)}
                  {" · "}
                  {restaurantLabelForLogRow(selected)}
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-8">
                <DetailBlock
                  label="Empfänger"
                  value={recipientLabelForLogRow(selected)}
                />
                <DetailBlock
                  label="Kanal / Status"
                  value={`${notificationChannelLabel(selected.channel)} · ${
                    selected.row_kind === "event_only"
                      ? selected.last_error === "event_pending"
                        ? "Event wartet auf Verarbeitung"
                        : "Keine Delivery erzeugt"
                      : notificationDeliveryStatusLabel(selected.delivery_status)
                  }`}
                />
                <DetailBlock label="Referenz" value={selected.reference_id} mono />
                <DetailBlock
                  label="Event erstellt"
                  value={formatNotificationLogDt(selected.event_created_at)}
                />
                <DetailBlock
                  label="Event verarbeitet"
                  value={formatNotificationLogDt(selected.event_processed_at)}
                />
                {sourceTimestampFromPayload(selected.module, selected.payload) ? (
                  <DetailBlock
                    label="Auslöser (Quelle)"
                    value={formatNotificationLogDt(
                      sourceTimestampFromPayload(selected.module, selected.payload),
                    )}
                  />
                ) : null}
                <DetailBlock
                  label="Versand / geplant"
                  value={
                    selected.sent_at
                      ? formatNotificationLogDt(selected.sent_at)
                      : selected.scheduled_at &&
                          selected.delivery_status === "pending"
                        ? `Geplant ${formatNotificationLogDt(selected.scheduled_at)}`
                        : "—"
                  }
                />
                {selected.last_error &&
                selected.row_kind === "delivery" &&
                selected.delivery_status === "failed" ? (
                  <DetailBlock label="Fehler" value={selected.last_error} mono />
                ) : null}
                {selected.delivery_attempts != null ? (
                  <DetailBlock
                    label="Versuche"
                    value={String(selected.delivery_attempts)}
                  />
                ) : null}
                {selected.delivery_status === "pending" &&
                selected.delivery_attempts === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    0 Versuche heißt: der Versand-Cron hat diese Zeile noch
                    nicht abgeholt (attempts steigt erst nach Claim). Nach dem
                    Deploy werden Backlogs pro Lauf schneller abgearbeitet.
                  </p>
                ) : null}
                {selected.idempotency_key ? (
                  <DetailBlock
                    label="Idempotency-Key"
                    value={selected.idempotency_key}
                    mono
                  />
                ) : null}
                <CopyableDetailBlock
                  label="Payload"
                  copyLabel="Payload"
                  value={JSON.stringify(selected.payload, null, 2)}
                  mono
                />
                <CopyableDetailBlock
                  label="Event-ID"
                  copyLabel="Event-ID"
                  value={selected.event_id}
                  mono
                />
                {selected.delivery_id ? (
                  <DetailBlock
                    label="Delivery-ID"
                    value={selected.delivery_id}
                    mono
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
