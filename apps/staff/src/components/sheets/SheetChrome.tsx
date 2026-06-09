import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

type SheetChromeProps = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function SheetChrome({
  title,
  subtitle,
  onClose,
  closeLabel = "Schließen",
  children,
  footer,
}: SheetChromeProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, gwadaSpacing.md) }]}>
      <View style={styles.grabberWrap}>
        <View style={styles.grabber} />
      </View>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text allowFontScaling style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text allowFontScaling style={styles.close}>
              {closeLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
    },
    grabberWrap: {
      alignItems: "center",
      paddingTop: gwadaSpacing.sm,
      paddingBottom: gwadaSpacing.xs,
    },
    grabber: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.fillSecondary,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.sm,
      gap: gwadaSpacing.md,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
    },
    close: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.accent,
    },
    body: {
      flex: 1,
      paddingHorizontal: gwadaSpacing.lg,
    },
    footer: {
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.sm,
      gap: gwadaSpacing.sm,
    },
  });
}
