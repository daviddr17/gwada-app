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
        {(active) => <DashboardHomeScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="menu">
        {(active) => <MenuOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="inventory">
        {(active) => <InventoryOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="reservierungen">
        {(active) => <ReservationsOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="pos">
        {(active) => <PosOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="events">
        {(active) => <EventsOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="nachrichten">
        {(active) => <ContactsMessagesKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="news">
        {(active) => <NewsOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="bewertungen">
        {(active) => <ReviewsOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="insights">
        {(active) => <InsightsOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="galerie">
        {(active) => <GalleryOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="buchfuehrung">
        {(active) => <AccountingInvoicesKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="dokumente">
        {(active) => <DocumentsOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="checklisten">
        {(active) => <ChecklistenHomeKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="mitarbeiter">
        {(active) => <StaffOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
    </>
  );
}
