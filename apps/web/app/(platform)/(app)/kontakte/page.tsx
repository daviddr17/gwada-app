import { redirect } from "next/navigation";

export default function KontaktePage() {
  redirect("/kontakte/nachrichten?platform=all");
}
