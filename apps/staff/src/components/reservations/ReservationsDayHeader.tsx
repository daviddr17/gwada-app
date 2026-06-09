import { StyleSheet, Text, View } from "react-native";
import { formatDayHeadingDe, localDayKey } from "@gwada/shared";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type ReservationsDayHeaderProps = {
  day: Date;
  reservationCount: number;
  partyTotal: number;
  isToday: boolean;
  holidayName?: string | null;
};

export function ReservationsDayHeader({
  day,
  reservationCount,
  partyTotal,
  isToday,
  holidayName,
}: ReservationsDayHeaderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.wrap, isToday && styles.wrapToday]}>
      {isToday ? (
        <Text allowFontScaling style={styles.todayLabel}>
          Heute
        </Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text allowFontScaling style={styles.title}>
          {formatDayHeadingDe(day)}
        </Text>
        {holidayName ? (
          <View style={styles.holidayChip}>
            <Text allowFontScaling style={styles.holidayText} numberOfLines={1}>
              {holidayName}
            </Text>
          </View>
        ) : null}
      </View>
      <Text allowFontScaling style={styles.meta}>
        {reservationCount === 1
          ? "1 Reservierung"
          : `${reservationCount} Reservierungen`}
        {" · "}
        {partyTotal === 1 ? "1 Person" : `${partyTotal} Personen`}
      </Text>
    </View>
  );
}

export function dayHeaderKey(day: Date): string {
  return localDayKey(day);
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: gwadaSpacing.md,
      paddingTop: gwadaSpacing.md,
      paddingBottom: gwadaSpacing.sm,
      gap: 4,
    },
    wrapToday: {
      borderLeftWidth: 3,
      borderLeftColor: colors.success,
      paddingLeft: gwadaSpacing.lg - 3,
    },
    todayLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.success,
    },
    titleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      flexShrink: 1,
    },
    holidayChip: {
      maxWidth: "100%",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: gwadaRadii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    holidayText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    meta: {
      fontSize: 13,
      color: colors.textMuted,
    },
  });
}
