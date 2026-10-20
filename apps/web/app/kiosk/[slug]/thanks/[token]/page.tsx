import { KioskThanksClient } from "@/components/ordering/kiosk-thanks-client";

export default async function KioskThanksPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  return <KioskThanksClient slug={slug} token={token} />;
}
