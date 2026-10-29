"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inboxPersonalMailboxHref } from "@/lib/contact-messages/inbox-mailbox";
import { WorkspaceRestaurantResolvePlaceholder } from "@/components/workspace/workspace-restaurant-placeholder";

/**
 * Legacy Aufgaben → Nachrichten tab. Redirects into Nachrichten persönliches Postfach.
 */
export function AufgabenNachrichtenScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  useEffect(() => {
    router.replace(
      inboxPersonalMailboxHref({ conversationId }),
      { scroll: false },
    );
  }, [router, conversationId]);

  return <WorkspaceRestaurantResolvePlaceholder />;
}
