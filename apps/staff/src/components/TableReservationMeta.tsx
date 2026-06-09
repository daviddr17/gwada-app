import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatReservationGuestLabel,
  type TableReservationRow,
} from "@/src/lib/dining-floor";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

type TableReservationMetaProps = {
  current: TableReservationRow[];
  next: TableReservationRow | null;
  onPressReservation: (row: TableReservationRow) => void;
};

function reservationLine(
  row: TableReservationRow,
  prefix: string,
): string {
  const time = timeFmt.format(new Date(row.starts_at));
  const guest = formatReservationGuestLabel(row);
  const lastName = guest.split(" ").pop() ?? guest;
  return `${prefix} ${time} · ${lastName} · ${row.party_size} Pers.`;
}

export function TableReservationMeta({
  current,
  next,
  onPressReservation,
}: TableReservationMetaProps) {
  const styles = useThemedStyles(createStyles);

  if (current.length === 0 && !next) return null;

  return (
    <View style={styles.wrap}>
      {current.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => onPressReservation(row)}
          style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
          accessibilityRole="button"
          accessibilityLabel="Reservierung anzeigen"
        >
          <Text style={[styles.lineText, styles.lineTextActive]}>
            {reservationLine(row, "Jetzt")}
          </Text>
        </Pressable>
      ))}
      {next ? (
        <Pressable
          onPress={() => onPressReservation(next)}
          style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
          accessibilityRole="button"
          accessibilityLabel="Reservierung anzeigen"
        >
          <Text style={styles.lineText}>{reservationLine(next, "Res.")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      marginTop: gwadaSpacing.sm,
      gap: 4,
    },
    line: {
      borderRadius: gwadaRadii.button,
      paddingVertical: 2,
      paddingHorizontal: 4,
      marginHorizontal: -4,
    },
    linePressed: {
      backgroundColor: "rgba(0,0,0,0.04)",
    },
    lineText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    lineTextActive: {
      color: colors.warning,
      fontWeight: "600",
    },
  });
}
