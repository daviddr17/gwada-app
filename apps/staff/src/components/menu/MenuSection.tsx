import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import type { ViewStyle } from "react-native";

type MenuSectionProps = {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function MenuSection({ title, footer, children, style }: MenuSectionProps) {
  return (
    <GroupedSection title={title} footer={footer} style={style}>
      <GroupedList>{children}</GroupedList>
    </GroupedSection>
  );
}
