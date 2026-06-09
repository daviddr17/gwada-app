import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "@/src/components/Button";
import { SheetChrome } from "@/src/components/sheets/SheetChrome";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export type StatusFilterOption = { id: string; name: string };

type ReservationsFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  unconfirmedMode: boolean;
  statusFilterId: string;
  statusOptions: StatusFilterOption[];
  hidePastReservations: boolean;
  hideEmptyDays: boolean;
  showHidePast: boolean;
  onStatusFilterIdChange: (id: string) => void;
  onHidePastChange: (value: boolean) => void;
  onHideEmptyDaysChange: (value: boolean) => void;
  onUnconfirmedModeChange: (value: boolean) => void;
  onReset: () => void;
};

export function ReservationsFilterSheet({
  visible,
  onClose,
  unconfirmedMode,
  statusFilterId,
  statusOptions,
  hidePastReservations,
  hideEmptyDays,
  showHidePast,
  onStatusFilterIdChange,
  onHidePastChange,
  onHideEmptyDaysChange,
  onUnconfirmedModeChange,
  onReset,
}: ReservationsFilterSheetProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SheetChrome
        title="Filter"
        onClose={onClose}
        footer={
          <View style={styles.footer}>
            <Button label="Zurücksetzen" variant="secondary" onPress={onReset} />
            <Button label="Fertig" onPress={onClose} />
          </View>
        }
      >
        <View style={styles.body}>
          <View style={styles.switchRow}>
            <Text allowFontScaling style={styles.switchLabel}>
              Nur unbestätigte
            </Text>
            <Switch
              value={unconfirmedMode}
              onValueChange={onUnconfirmedModeChange}
            />
          </View>

          {!unconfirmedMode ? (
            <View style={styles.section}>
              <Text allowFontScaling style={styles.sectionTitle}>
                Status
              </Text>
              <Pressable
                onPress={() => onStatusFilterIdChange("all")}
                style={[
                  styles.option,
                  statusFilterId === "all" && styles.optionActive,
                ]}
              >
                <Text allowFontScaling style={styles.optionText}>
                  Alle
                </Text>
              </Pressable>
              {statusOptions.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => onStatusFilterIdChange(opt.id)}
                  style={[
                    styles.option,
                    statusFilterId === opt.id && styles.optionActive,
                  ]}
                >
                  <Text allowFontScaling style={styles.optionText}>
                    {opt.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {showHidePast && !unconfirmedMode ? (
            <View style={styles.switchRow}>
              <Text allowFontScaling style={styles.switchLabel}>
                Vergangene ausblenden
              </Text>
              <Switch
                value={hidePastReservations}
                onValueChange={onHidePastChange}
              />
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text allowFontScaling style={styles.switchLabel}>
              Leere Tage ausblenden
            </Text>
            <Switch
              value={hideEmptyDays}
              onValueChange={onHideEmptyDaysChange}
            />
          </View>
        </View>
      </SheetChrome>
    </Modal>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    body: {
      gap: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.xl,
    },
    section: {
      gap: gwadaSpacing.xs,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    option: {
      paddingVertical: 12,
      paddingHorizontal: gwadaSpacing.md,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionActive: {
      borderColor: colors.accent,
      backgroundColor: `${colors.accent}12`,
    },
    optionText: {
      fontSize: 16,
      color: colors.text,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: gwadaSpacing.md,
      paddingVertical: 4,
    },
    switchLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    footer: {
      gap: gwadaSpacing.sm,
    },
  });
}
