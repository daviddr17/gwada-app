import { redirect } from "next/navigation";

export default function BewertungenGwadaRedirectPage() {
  redirect("/bewertungen/uebersicht?platform=gwada");
}
