import { StyleSheet, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { listSeparatorInset } from "@/src/theme/list-styles";

export function ListSeparator() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.separator} />;
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
      marginLeft: listSeparatorInset,
    },
  });
}
