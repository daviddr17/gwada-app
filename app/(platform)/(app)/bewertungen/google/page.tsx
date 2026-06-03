import { redirect } from "next/navigation";

export default function BewertungenGoogleRedirectPage() {
  redirect("/bewertungen/uebersicht?platform=google");
}
