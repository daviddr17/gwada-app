"use client";

import { AccountingInvoicesKeepAliveScreen } from "@/components/accounting/accounting-invoices-keep-alive-screen";
import { ChecklistenHomeKeepAliveScreen } from "@/components/checklisten/checklisten-home-keep-alive-screen";
import { ContactsMessagesKeepAliveScreen } from "@/components/contacts/contacts-messages-keep-alive-screen";
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen";
import { DocumentsOverviewKeepAliveScreen } from "@/components/documents/documents-overview-keep-alive-screen";
import { EventsOverviewKeepAliveScreen } from "@/components/events/events-overview-keep-alive-screen";
import { GalleryOverviewKeepAliveScreen } from "@/components/gallery/gallery-overview-keep-alive-screen";
import { InsightsOverviewKeepAliveScreen } from "@/components/insights/insights-overview-keep-alive-screen";
import { InventoryOverviewKeepAliveScreen } from "@/components/inventory/inventory-overview-keep-alive-screen";
import { MenuOverviewKeepAliveScreen } from "@/components/menu/menu-overview-keep-alive-screen";
import { ModuleHomeKeepAliveSlot } from "@/components/navigation/module-home-keep-alive-slot";
import { NewsOverviewKeepAliveScreen } from "@/components/news/news-overview-keep-alive-screen";
import { PosOverviewKeepAliveScreen } from "@/components/pos/pos-overview-keep-alive-screen";
import { ReservationsOverviewKeepAliveScreen } from "@/components/reservations/reservations-overview-keep-alive-screen";
import { ReviewsOverviewKeepAliveScreen } from "@/components/reviews/reviews-overview-keep-alive-screen";
import { StaffOverviewKeepAliveScreen } from "@/components/staff/staff-overview-keep-alive-screen";

/** Alle warmen Modul-Homes — Sibling zu Route-Children in der App-Shell. */
export function AppModuleHomeKeepAlives() {
  return (
    <>
      <ModuleHomeKeepAliveSlot id="dashboard">
        {({ active, showChrome }) => (
          <DashboardHomeScreen active={active} showChrome={showChrome} />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="menu">
        {({ active, showChrome }) => (
          <MenuOverviewKeepAliveScreen active={active} showChrome={showChrome} />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="inventory">
        {({ active, showChrome }) => (
          <InventoryOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="reservierungen">
        {({ active, showChrome }) => (
          <ReservationsOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="pos">
        {({ active, showChrome }) => (
          <PosOverviewKeepAliveScreen active={active} showChrome={showChrome} />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="events">
        {({ active, showChrome }) => (
          <EventsOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="nachrichten">
        {({ active, showChrome }) => (
          <ContactsMessagesKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="news">
        {({ active, showChrome }) => (
          <NewsOverviewKeepAliveScreen active={active} showChrome={showChrome} />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="bewertungen">
        {({ active, showChrome }) => (
          <ReviewsOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="insights">
        {({ active, showChrome }) => (
          <InsightsOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="galerie">
        {({ active, showChrome }) => (
          <GalleryOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="buchfuehrung">
        {({ active, showChrome }) => (
          <AccountingInvoicesKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="dokumente">
        {({ active, showChrome }) => (
          <DocumentsOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="checklisten">
        {({ active, showChrome }) => (
          <ChecklistenHomeKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="mitarbeiter">
        {({ active, showChrome }) => (
          <StaffOverviewKeepAliveScreen
            active={active}
            showChrome={showChrome}
          />
        )}
      </ModuleHomeKeepAliveSlot>
    </>
  );
}
