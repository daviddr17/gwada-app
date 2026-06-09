import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export type OrderCartLine = {
  menuItemId: string;
  name: string;
  unitCents: number;
  quantity: number;
};

type OrderCartSheetProps = {
  visible: boolean;
  lines: OrderCartLine[];
  totalCents: number;
  itemCount: number;
  submitting: boolean;
  onClose: () => void;
  onChangeQty: (menuItemId: string, delta: number) => void;
  onSubmit: () => void;
};

export function OrderCartSheet({
  visible,
  lines,
  totalCents,
  itemCount,
  submitting,
  onClose,
  onChangeQty,
  onSubmit,
}: OrderCartSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { paddingTop: gwadaSpacing.md }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Warenkorb</Text>
            <Text style={styles.subtitle}>
              {itemCount} Artikel · {formatCentsEUR(totalCents)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Warenkorb schließen"
            style={styles.closeBtn}
          >
            <Text style={styles.closeBtnText}>Schließen</Text>
          </Pressable>
        </View>

        <FlatList
          data={lines}
          keyExtractor={(line) => line.menuItemId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.lineSeparator} />}
          renderItem={({ item: line }) => (
            <View style={styles.cartLine}>
              <View style={styles.cartLineText}>
                <Text style={styles.cartLineName}>{line.name}</Text>
                <Text style={styles.cartLinePrice}>
                  {formatCentsEUR(line.unitCents * line.quantity)}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Pressable
                  onPress={() => onChangeQty(line.menuItemId, -1)}
                  style={styles.qtyBtn}
                  accessibilityLabel={`${line.name} Menge verringern`}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable
                  onPress={() => onChangeQty(line.menuItemId, 1)}
                  style={styles.qtyBtn}
                  accessibilityLabel={`${line.name} Menge erhöhen`}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}
        />

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, gwadaSpacing.md) },
          ]}
        >
          <Button
            label={`Bestellung senden (${formatCentsEUR(totalCents)})`}
            loading={submitting}
            disabled={lines.length === 0}
            onPress={onSubmit}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: gwadaColors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: gwadaSpacing.lg,
    paddingBottom: gwadaSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: gwadaColors.border,
    gap: gwadaSpacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: gwadaColors.textMuted,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: gwadaColors.accent,
  },
  listContent: {
    paddingHorizontal: gwadaSpacing.lg,
    paddingVertical: gwadaSpacing.md,
    flexGrow: 1,
  },
  lineSeparator: { height: gwadaSpacing.sm },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: gwadaSpacing.sm,
    backgroundColor: gwadaColors.surface,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    borderRadius: gwadaRadii.card,
    padding: gwadaSpacing.md,
  },
  cartLineText: { flex: 1 },
  cartLineName: { fontSize: 15, fontWeight: "600", color: gwadaColors.text },
  cartLinePrice: { fontSize: 13, color: gwadaColors.textMuted, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: gwadaColors.background,
  },
  qtyBtnText: { fontSize: 18, fontWeight: "600", color: gwadaColors.text },
  qtyValue: {
    minWidth: 20,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: gwadaColors.text,
  },
  footer: {
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: gwadaSpacing.md,
    borderTopWidth: 1,
    borderTopColor: gwadaColors.border,
    backgroundColor: gwadaColors.surface,
  },
});
