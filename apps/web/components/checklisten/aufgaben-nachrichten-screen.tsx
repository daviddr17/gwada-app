"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { dispatchNotificationsRefresh } from "@/lib/notifications/notification-events";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import {
  peekStaffListCache,
  writeStaffListCache,
} from "@/lib/staff/staff-list-client-cache";
import { buildStaffSearchableSelectOptions } from "@/lib/staff/staff-select-options";
import {
  ensureStaffConversation,
  fetchStaffConversationsForRestaurant,
  fetchStaffMessages,
  markStaffConversationRead,
  sendStaffMessage,
} from "@/lib/supabase/staff-messages-db";
import type {
  RestaurantStaffConversationRow,
  RestaurantStaffMessageRow,
} from "@/lib/types/staff-messages";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { cn } from "@/lib/utils";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function AufgabenNachrichtenScreen() {
  const searchParams = useSearchParams();
  const conversationFromUrl = searchParams.get("c");
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [staff, setStaff] = useState<RestaurantStaffRow[]>([]);
  const [conversations, setConversations] = useState<
    RestaurantStaffConversationRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RestaurantStaffMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [peerStaffId, setPeerStaffId] = useState<string | null>(null);
  const showSkeleton = useDeferredSkeleton(loading);

  const reloadList = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const uid = user?.id ?? null;
    setProfileId(uid);

    let staffRows: RestaurantStaffRow[] = [];
    const cached = peekStaffListCache(restaurantId);
    if (cached?.rows?.length) {
      staffRows = cached.rows;
    } else {
      const res = await fetchStaffForRestaurant(restaurantId);
      if (!res.error) {
        writeStaffListCache(restaurantId, {
          rows: res.data,
          contracts: [],
        });
        staffRows = res.data;
      }
    }
    setStaff(staffRows.filter((s) => s.is_active && s.profile_id));

    if (!uid) {
      setLoading(false);
      setConversations([]);
      return;
    }

    const { data, error } = await fetchStaffConversationsForRestaurant({
      restaurantId,
      profileId: uid,
      staff: staffRows,
    });
    setLoading(false);
    if (error && isMissingSchemaError(error)) {
      setSchemaMissing(true);
      setConversations([]);
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    setSchemaMissing(false);
    setConversations(data);
  }, [restaurantId]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    if (conversationFromUrl) setActiveId(conversationFromUrl);
  }, [conversationFromUrl]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      if (!profileId) return;
      const { data, error } = await fetchStaffMessages({ conversationId });
      if (error) {
        toast.error(error);
        return;
      }
      setMessages(data);
      await markStaffConversationRead({
        conversationId,
        profileId,
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, is_unread: false } : c,
        ),
      );
    },
    [profileId],
  );

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void loadThread(activeId);
  }, [activeId, loadThread]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const peerOptions = useMemo(() => {
    const linked = staff.filter(
      (s) => s.profile_id && s.profile_id !== profileId,
    );
    return buildStaffSearchableSelectOptions(linked);
  }, [staff, profileId]);

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        size="lg"
        className={modulePrimaryAddButtonFullWidthClassName}
        onClick={() => {
          setPeerStaffId(null);
          setNewOpen(true);
        }}
        disabled={schemaMissing || !profileId}
      >
        <MessageSquarePlus className="size-4" />
        Neue Nachricht
      </Button>

      {schemaMissing ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Team-Nachrichten sind noch nicht auf der Datenbank aktiv. Bitte
            Migration anwenden.
          </CardContent>
        </Card>
      ) : showSkeleton ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <Card className="border-border/50 shadow-card">
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Noch keine Team-Chats. Schreibe einem Kollegen.
                </CardContent>
              </Card>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-xl border border-border/50 px-3 py-2.5 text-left transition-colors",
                    activeId === c.id
                      ? "bg-muted/40"
                      : "bg-background hover:bg-muted/25",
                    c.is_unread && "border-l-2 border-l-accent",
                  )}
                >
                  <span className="text-sm font-medium">{c.peer_name}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {c.last_message_preview || "Noch keine Nachrichten"}
                  </span>
                </button>
              ))
            )}
          </div>

          <Card className="border-border/50 shadow-card min-h-72">
            <CardContent className="flex h-full min-h-72 flex-col gap-3 py-4">
              {!active ? (
                <p className="m-auto text-sm text-muted-foreground">
                  Konversation auswählen
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">{active.peer_name}</p>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                    {messages.map((m) => {
                      const mine = m.sender_profile_id === profileId;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                            mine
                              ? "ml-auto bg-accent/15"
                              : "mr-auto bg-muted/40",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {m.body}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {formatMsgTime(m.created_at)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      maxLength={8000}
                      placeholder="Nachricht schreiben…"
                      className="min-h-0 flex-1 resize-none"
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={sending || !draft.trim()}
                      aria-label="Senden"
                      onClick={async () => {
                        if (!restaurantId || !profileId || !activeId) return;
                        setSending(true);
                        const { error } = await sendStaffMessage({
                          restaurantId,
                          conversationId: activeId,
                          senderProfileId: profileId,
                          body: draft,
                        });
                        setSending(false);
                        if (error) {
                          toast.error(error);
                          return;
                        }
                        setDraft("");
                        await loadThread(activeId);
                        void reloadList();
                        dispatchNotificationsRefresh();
                      }}
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Drawer
        open={newOpen}
        onOpenChange={setNewOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("assign")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Kollege anschreiben
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Interner 1:1-Chat — nicht im Gäste-Postfach.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFormBody>
            <div className={drawerScrollAreaClassName(6)}>
              <DrawerFormSection>
                <SearchableSelect
                  value={peerStaffId}
                  onValueChange={setPeerStaffId}
                  options={peerOptions}
                  placeholder="Mitarbeiter wählen"
                  className={appSelectTriggerAccentCn("h-10 w-full")}
                />
              </DrawerFormSection>
            </div>
          </DrawerFormBody>
          <DrawerFormFooter
            submitType="button"
            onCancel={() => setNewOpen(false)}
            submitLabel="Chat öffnen"
            submitDisabled={!peerStaffId || !profileId}
            onSubmit={async () => {
              if (!restaurantId || !profileId || !peerStaffId) return;
              const peer = staff.find((s) => s.id === peerStaffId);
              if (!peer?.profile_id) {
                toast.error("Mitarbeiter hat kein App-Konto");
                return;
              }
              const { data: conversationId, error } =
                await ensureStaffConversation({
                  restaurantId,
                  selfProfileId: profileId,
                  peerProfileId: peer.profile_id,
                });
              if (error || !conversationId) {
                toast.error(error ?? "Chat konnte nicht geöffnet werden");
                return;
              }
              setNewOpen(false);
              await reloadList();
              setActiveId(conversationId);
            }}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
