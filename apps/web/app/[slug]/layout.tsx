import { PublicThemeToggleDeferred } from "@/components/public/public-theme-toggle-deferred";
import { EmbedProviders } from "@/components/providers/embed-providers";

export const revalidate = 60;

export default function PublicRestaurantProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EmbedProviders>
      <PublicThemeToggleDeferred />
      <div className="flex h-dvh flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </EmbedProviders>
  );
}
