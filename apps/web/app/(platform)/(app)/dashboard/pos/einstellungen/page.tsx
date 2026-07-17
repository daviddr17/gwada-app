import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export default function PosEinstellungenPage() {
  redirect(APP_ROUTES.pos.settingsFiscalPayment);
}
