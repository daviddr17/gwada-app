"use client";

import { ContactsMessagesKeepAliveScreen } from "@/components/contacts/contacts-messages-keep-alive-screen";
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen";
import { InventoryOverviewKeepAliveScreen } from "@/components/inventory/inventory-overview-keep-alive-screen";
import { MenuOverviewKeepAliveScreen } from "@/components/menu/menu-overview-keep-alive-screen";
import { ModuleHomeKeepAliveSlot } from "@/components/navigation/module-home-keep-alive-slot";
import { ReservationsOverviewKeepAliveScreen } from "@/components/reservations/reservations-overview-keep-alive-screen";
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
      <ModuleHomeKeepAliveSlot id="nachrichten">
        {(active) => <ContactsMessagesKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
      <ModuleHomeKeepAliveSlot id="mitarbeiter">
        {(active) => <StaffOverviewKeepAliveScreen active={active} />}
      </ModuleHomeKeepAliveSlot>
    </>
  );
}
