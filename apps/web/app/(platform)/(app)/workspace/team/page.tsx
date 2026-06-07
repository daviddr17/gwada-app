import { redirect } from "next/navigation";

export default function WorkspaceTeamRedirectPage() {
  redirect("/settings/team");
}
