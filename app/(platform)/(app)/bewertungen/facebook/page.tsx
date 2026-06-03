import { redirect } from "next/navigation";

export default function BewertungenFacebookRedirectPage() {
  redirect("/bewertungen/uebersicht?platform=facebook");
}
