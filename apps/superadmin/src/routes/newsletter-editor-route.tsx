"use client";

import { SuperadminNewsletterEditorScreen } from "@/components/superadmin/newsletter/superadmin-newsletter-editor-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { useParams } from "next/navigation";
import { SuperadminChromeRoute } from "./with-chrome";

const NEWSLETTER_NAV: readonly ModuleSubnavItem[] = [
  { href: "/superadmin/newsletter", label: "Übersicht", matchMode: "exact" },
  {
    href: "/superadmin/newsletter/vorlagen",
    label: "Vorlagen",
    matchMode: "exact",
  },
];

export default function NewsletterEditorRoute() {
  const params = useParams<{ id: string }>();
  return (
    <SuperadminChromeRoute
      title="Newsletter"
      subnavAriaLabel="Superadmin Newsletter"
      subnavItems={NEWSLETTER_NAV}
    >
      <SuperadminNewsletterEditorScreen newsletterId={params.id ?? ""} />
    </SuperadminChromeRoute>
  );
}
