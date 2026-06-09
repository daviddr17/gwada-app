import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatMonthTitleDe } from "@gwada/shared";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type ReservationsMonthToolbarProps = {
  year: number;
  month: number;
  filterActiveCount: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onOpenFilter: () => void;
};

export function ReservationsMonthToolbar({
  year,
  month,
  filterActiveCount,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  onYearChange,
  onOpenFilter,
}: ReservationsMonthToolbarProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useStaffTheme();
  const [picker, setPicker] = useState<"month" | "year" | null>(null);

  const nowY = new Date().getFullYear();
  const yearMin = nowY - 1;
  const yearMax = nowY + 2;

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        new Intl.DateTimeFormat("de-DE", { month: "long" }).format(
          new Date(2000, m, 1),
        ),
      ),
    [],
  );

  const years = useMemo(
    () =>
      Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i),
    [yearMax, yearMin],
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPrevMonth}
        style={styles.iconBtn}
        accessibilityLabel="Vorheriger Monat"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      <Pressable
        onPress={() => setPicker("month")}
        style={styles.pickerBtn}
      >
        <Text allowFontScaling style={styles.pickerText} numberOfLines={1}>
          {monthLabels[month]}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setPicker("year")}
        style={[styles.pickerBtn, styles.yearBtn]}
      >
        <Text allowFontScaling style={styles.pickerText}>
          {year}
        </Text>
      </Pressable>

      <Pressable
        onPress={onNextMonth}
        style={styles.iconBtn}
        accessibilityLabel="Nächster Monat"
      >
        <Ionicons name="chevron-forward" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.filterWrap}>
        <Pressable
          onPress={onOpenFilter}
          style={styles.iconBtn}
          accessibilityLabel="Filter"
        >
          <Ionicons name="filter" size={20} color={colors.text} />
        </Pressable>
        {filterActiveCount > 0 ? (
          <View style={styles.badge}>
            <Text allowFontScaling style={styles.badgeText}>
              {filterActiveCount}
            </Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={picker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll}>
              {picker === "month"
                ? monthLabels.map((label, m) => (
                    <Pressable
                      key={label}
                      style={[
                        styles.modalOption,
                        m === month && styles.modalOptionActive,
                      ]}
                      onPress={() => {
                        onMonthChange(m);
                        setPicker(null);
                      }}
                    >
                      <Text allowFontScaling style={styles.modalOptionText}>
                        {label}
                      </Text>
                    </Pressable>
                  ))
                : years.map((y) => (
                    <Pressable
                      key={y}
                      style={[
                        styles.modalOption,
                        y === year && styles.modalOptionActive,
                      ]}
                      onPress={() => {
                        onYearChange(y);
                        setPicker(null);
                      }}
                    >
                      <Text allowFontScaling style={styles.modalOptionText}>
                        {y}
                      </Text>
                    </Pressable>
                  ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ReservationsMonthTitle(year: number, month: number): string {
  return formatMonthTitleDe(year, month);
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: gwadaSpacing.xs,
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: gwadaRadii.button,
    },
    pickerBtn: {
      flex: 1,
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: 10,
      borderRadius: gwadaRadii.button,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    yearBtn: {
      flex: 0,
      minWidth: 72,
    },
    pickerText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.text,
      textAlign: "center",
    },
    filterWrap: {
      position: "relative",
    },
    badge: {
      position: "absolute",
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      backgroundColor: colors.accent,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.accentForeground,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      padding: gwadaSpacing.xl,
    },
    modalCard: {
      maxHeight: "60%",
      borderRadius: gwadaRadii.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    modalScroll: {
      maxHeight: 360,
    },
    modalOption: {
      paddingVertical: 14,
      paddingHorizontal: gwadaSpacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    modalOptionActive: {
      backgroundColor: `${colors.accent}12`,
    },
    modalOptionText: {
      fontSize: 17,
      color: colors.text,
      textAlign: "center",
    },
  });
}
