import { KioskLockedShell } from "@/components/ordering/kiosk-locked-shell";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";

export default async function KioskCounterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [restaurant, menu] = await Promise.all([
    resolveRestaurantBySlug(slug),
    fetchPublicEmbedMenu(slug),
  ]);

  return (
    <KioskLockedShell
      slug={slug}
      mode="kiosk"
      restaurantName={restaurant.ok ? restaurant.name : undefined}
      accentHex={menu.data?.accentHex}
    />
  );
}
