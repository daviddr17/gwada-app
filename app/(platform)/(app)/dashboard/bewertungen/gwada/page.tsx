import { redirect } from "next/navigation";

export default function BewertungenGwadaRedirectPage() {
  redirect("/dashboard/bewertungen/uebersicht?platform=gwada");
}
