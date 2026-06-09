import { MenuScreen } from "@/src/components/menu/MenuScreen";
import { useStaffMenuSections } from "@/src/lib/menu/menu-sections";

export default function MenuScreenRoute() {
  const sections = useStaffMenuSections();
  return <MenuScreen sections={sections} />;
}
