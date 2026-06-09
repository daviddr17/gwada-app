import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

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
  const insets = useSafeAreaInsets();
  const overCapacity = coverCount > capacity;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { paddingBottom: insets.bottom + gwadaSpacing.lg }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Personen am Tisch</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Schließen</Text>
          </Pressable>
        </View>

        <Text style={styles.tableLabel}>{tableLabel}</Text>
        <Text style={styles.hint}>
          Kapazität: {capacity} Plätze — für Statistik und spätere Umsetzung.
        </Text>

        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => onChangeCount(Math.max(1, coverCount - 1))}
            style={styles.stepBtn}
            disabled={coverCount <= 1}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.count}>{coverCount}</Text>
          <Pressable
            onPress={() => onChangeCount(Math.min(50, coverCount + 1))}
            style={styles.stepBtn}
            disabled={coverCount >= 50}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>

        {overCapacity ? (
          <Text style={styles.warn}>
            Mehr Personen als Plätze — bei starkem Andrang möglich.
          </Text>
        ) : null}

        <Button
          label="Session starten"
          onPress={onConfirm}
          loading={loading}
          style={styles.primary}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: gwadaColors.background,
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: gwadaSpacing.lg,
    gap: gwadaSpacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  close: {
    fontSize: 16,
    color: gwadaColors.textMuted,
  },
  tableLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: gwadaColors.text,
  },
  hint: {
    fontSize: 14,
    color: gwadaColors.textMuted,
    lineHeight: 20,
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
    borderWidth: 1,
    borderColor: gwadaColors.border,
    backgroundColor: gwadaColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 28,
    fontWeight: "500",
    color: gwadaColors.text,
  },
  count: {
    fontSize: 40,
    fontWeight: "700",
    color: gwadaColors.text,
    minWidth: 56,
    textAlign: "center",
  },
  warn: {
    fontSize: 13,
    color: gwadaColors.destructive,
    textAlign: "center",
  },
  primary: {
    marginTop: gwadaSpacing.sm,
  },
});
