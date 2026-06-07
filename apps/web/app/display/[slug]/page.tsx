import { DisplayScreen } from "@/components/display/display-screen";

export default async function DisplayRestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DisplayScreen slug={slug} />;
}
