import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/src/components/Button";
import { SheetChrome } from "@/src/components/sheets/SheetChrome";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type CoverCountSheetProps = {
  visible: boolean;
  tableLabel: string;
  capacity: number;
  coverCount: number;
  onChangeCount: (count: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
};

export function CoverCountSheet({
  visible,
  tableLabel,
  capacity,
  coverCount,
  onChangeCount,
  onConfirm,
  onClose,
  loading,
}: CoverCountSheetProps) {
  const styles = useThemedStyles(createStyles);
  const overCapacity = coverCount > capacity;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SheetChrome
        title="Personen am Tisch"
        subtitle={tableLabel}
        onClose={onClose}
        footer={
          <Button
            label="Session starten"
            onPress={onConfirm}
            loading={loading}
          />
        }
      >
        <Text allowFontScaling style={styles.hint}>
          Kapazität: {capacity} Plätze
        </Text>

        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => onChangeCount(Math.max(1, coverCount - 1))}
            style={styles.stepBtn}
            disabled={coverCount <= 1}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text allowFontScaling style={styles.count}>
            {coverCount}
          </Text>
          <Pressable
            onPress={() => onChangeCount(Math.min(50, coverCount + 1))}
            style={styles.stepBtn}
            disabled={coverCount >= 50}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>

        {overCapacity ? (
          <Text allowFontScaling style={styles.warn}>
            Mehr Personen als Plätze — bei starkem Andrang möglich.
          </Text>
        ) : null}
      </SheetChrome>
    </Modal>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    hint: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: gwadaSpacing.md,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      marginVertical: gwadaSpacing.md,
    },
    stepBtn: {
      width: 52,
      height: 52,
      borderRadius: gwadaRadii.button,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    stepBtnText: {
      fontSize: 28,
      fontWeight: "500",
      color: colors.text,
    },
    count: {
      fontSize: 40,
      fontWeight: "700",
      color: colors.text,
      minWidth: 56,
      textAlign: "center",
    },
    warn: {
      fontSize: 13,
      color: colors.destructive,
      textAlign: "center",
    },
  });
}
