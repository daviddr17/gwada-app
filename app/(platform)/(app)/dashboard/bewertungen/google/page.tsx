import { redirect } from "next/navigation";

export default function BewertungenGoogleRedirectPage() {
  redirect("/dashboard/bewertungen/uebersicht?platform=google");
}
