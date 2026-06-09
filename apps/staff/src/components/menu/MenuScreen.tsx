import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ui";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

export type MenuSectionDef = {
  id: string;
  visible?: boolean;
  render: () => React.ReactNode;
};

type MenuScreenProps = {
  sections: MenuSectionDef[];
};

export function MenuScreen({ sections }: MenuScreenProps) {
  const styles = useThemedStyles(createStyles);
  const visibleSections = sections.filter((s) => s.visible !== false);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Menü" />
        <View style={styles.sections}>
          {visibleSections.map((section) => (
            <View key={section.id}>{section.render()}</View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
    },
    content: {
      paddingHorizontal: gwadaSpacing.md,
      paddingTop: gwadaSpacing.sm,
      paddingBottom: gwadaSpacing.xl,
    },
    sections: {
      gap: gwadaSpacing.lg,
    },
  });
}
