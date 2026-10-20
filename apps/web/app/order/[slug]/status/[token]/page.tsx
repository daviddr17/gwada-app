import { GuestOrderStatusScreen } from "@/components/ordering/guest-order-status-screen";

export default async function OnlineOrderStatusPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { token } = await params;
  return <GuestOrderStatusScreen token={token} />;
}
