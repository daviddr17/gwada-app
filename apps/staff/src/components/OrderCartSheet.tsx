import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { SheetChrome } from "@/src/components/sheets/SheetChrome";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";
import { listRowMinHeight } from "@/src/theme/list-styles";

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
  const styles = useThemedStyles(createStyles);
  const { colors } = useStaffTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SheetChrome
        title="Warenkorb"
        subtitle={`${itemCount} Artikel · ${formatCentsEUR(totalCents)}`}
        onClose={onClose}
        footer={
          <Button
            label={`Bestellung senden (${formatCentsEUR(totalCents)})`}
            loading={submitting}
            disabled={lines.length === 0}
            onPress={onSubmit}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.listContent}>
          {lines.length === 0 ? (
            <Text style={styles.empty}>Noch keine Artikel im Warenkorb.</Text>
          ) : (
          <GroupedList>
            {lines.map((line, index) => (
              <View key={line.menuItemId}>
                {index > 0 ? <ListSeparator /> : null}
                <View style={styles.cartLine}>
                  <View style={styles.cartLineText}>
                    <Text allowFontScaling style={styles.cartLineName}>
                      {line.name}
                    </Text>
                    <Text allowFontScaling style={styles.cartLinePrice}>
                      {formatCentsEUR(line.unitCents * line.quantity)}
                    </Text>
                  </View>
                  <View style={styles.qtyRow}>
                    <Pressable
                      onPress={() => onChangeQty(line.menuItemId, -1)}
                      style={[styles.qtyBtn, { borderColor: colors.accent }]}
                      accessibilityLabel={`${line.name} Menge verringern`}
                    >
                      <Text style={[styles.qtyBtnText, { color: colors.accent }]}>
                        −
                      </Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <Pressable
                      onPress={() => onChangeQty(line.menuItemId, 1)}
                      style={[
                        styles.qtyBtn,
                        styles.qtyBtnPlus,
                        { backgroundColor: colors.accent },
                      ]}
                      accessibilityLabel={`${line.name} Menge erhöhen`}
                    >
                      <Text
                        style={[
                          styles.qtyBtnText,
                          { color: colors.accentForeground },
                        ]}
                      >
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </GroupedList>
          )}
        </ScrollView>
      </SheetChrome>
    </Modal>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    listContent: {
      paddingVertical: gwadaSpacing.sm,
      flexGrow: 1,
    },
    cartLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: gwadaSpacing.sm,
      paddingHorizontal: gwadaSpacing.md,
      minHeight: listRowMinHeight,
      paddingVertical: 12,
    },
    cartLineText: { flex: 1 },
    cartLineName: { fontSize: 15, fontWeight: "600", color: colors.text },
    cartLinePrice: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    qtyBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    qtyBtnPlus: {
      borderWidth: 0,
    },
    qtyBtnText: { fontSize: 20, fontWeight: "600", lineHeight: 22 },
    qtyValue: {
      minWidth: 28,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      padding: gwadaSpacing.xl,
      fontSize: 15,
    },
  });
}
