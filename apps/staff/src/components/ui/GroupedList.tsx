import { StyleSheet, View, type ViewStyle } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { groupedListRadius } from "@/src/theme/list-styles";

type GroupedListProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function GroupedList({ children, style }: GroupedListProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.list, style]}>{children}</View>;
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    list: {
      backgroundColor: colors.surface,
      borderRadius: groupedListRadius,
      overflow: "hidden",
    },
  });
}
