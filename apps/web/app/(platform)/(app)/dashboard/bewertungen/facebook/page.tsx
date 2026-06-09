import { redirect } from "next/navigation";

export default function BewertungenFacebookRedirectPage() {
  redirect("/dashboard/bewertungen/uebersicht?platform=facebook");
}
