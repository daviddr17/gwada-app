import { GuestOrderingApp } from "@/components/ordering/guest-ordering-app";

export default async function OnlineOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col overflow-hidden">
      <GuestOrderingApp slug={slug} mode="online" className="h-full min-h-0" />
    </div>
  );
}
