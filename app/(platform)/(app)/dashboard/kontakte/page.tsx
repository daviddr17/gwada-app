import { redirect } from "next/navigation";

export default function KontaktePage() {
  redirect("/dashboard/kontakte/nachrichten?platform=all");
}
