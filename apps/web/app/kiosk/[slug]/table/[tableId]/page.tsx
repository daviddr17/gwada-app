import { KioskLockedShell } from "@/components/ordering/kiosk-locked-shell";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";

/** iPad on table — same locked shell, channel `table`. */
export default async function KioskTablePage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { slug, tableId } = await params;
  const [restaurant, menu] = await Promise.all([
    resolveRestaurantBySlug(slug),
    fetchPublicEmbedMenu(slug),
  ]);

  return (
    <KioskLockedShell
      slug={slug}
      mode="table"
      diningTableId={tableId}
      restaurantName={restaurant.ok ? restaurant.name : undefined}
      accentHex={menu.data?.accentHex}
    />
  );
}
