import { GuestOrderingApp } from "@/components/ordering/guest-ordering-app";

export default async function OnlineOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <GuestOrderingApp slug={slug} mode="online" />
    </div>
  );
}
