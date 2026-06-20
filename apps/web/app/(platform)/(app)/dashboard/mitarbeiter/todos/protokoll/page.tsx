import { redirect } from "next/navigation";

export default function StaffTodosProtocolRedirectPage() {
  redirect("/dashboard/mitarbeiter/todos");
}
