"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";

export function NewsletterPreviewDrawer({
  open,
  onOpenChange,
  subject,
  html,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  html: string | null;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={drawerContentClassName("wide", "max-h-[92vh]")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="truncate text-base">
            {subject || "Vorschau"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-[#f5f5f7] px-2 pb-6">
          {html ? (
            <iframe
              title="Newsletter-Vorschau"
              srcDoc={html}
              className="mx-auto h-[70vh] w-full max-w-[640px] rounded-xl border border-border/40 bg-white"
              sandbox=""
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Keine Vorschau</p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
