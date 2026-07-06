import type { Metadata } from "next";
import { DisplayScreen } from "@/components/display/display-screen";
import { displayPwaManifestPath } from "@/lib/display/display-pwa-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: displayPwaManifestPath(slug),
  };
}

export default async function DisplayRestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DisplayScreen slug={slug} />;
}
