import { InventorySectionChrome } from "@/components/inventory/inventory-section-chrome";

export default function InventoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background">
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <InventorySectionChrome />
        {children}
      </main>
    </div>
  );
}
