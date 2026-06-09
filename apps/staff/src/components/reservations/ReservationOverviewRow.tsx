import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatReservationGuestName,
  reservationDiningTableLabel,
} from "@gwada/shared";
import type { ReservationListRow } from "@/src/lib/reservations/reservations-db";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";
import { listRowMinHeight } from "@/src/theme/list-styles";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

type ReservationOverviewRowProps = {
  reservation: ReservationListRow;
  onPress: () => void;
};

function stripeColor(hex: string | undefined): string {
  return hex && /^#[0-9A-Fa-f]{6}$/i.test(hex) ? hex : "#64748b";
}

export function ReservationOverviewRow({
  reservation,
  onPress,
}: ReservationOverviewRowProps) {
  const styles = useThemedStyles(createStyles);
  const guest = formatReservationGuestName(reservation);
  const status = reservation.reservation_statuses;
  const timeLabel = timeFmt.format(new Date(reservation.starts_at));
  const endLabel = timeFmt.format(new Date(reservation.ends_at));
  const tableLabel = reservationDiningTableLabel(reservation);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Reservierung ${guest}`}
    >
      <View
        style={[styles.stripe, { backgroundColor: stripeColor(status?.color_hex) }]}
      />
      <View style={styles.timeCol}>
        <Text allowFontScaling style={styles.time}>
          {timeLabel}
        </Text>
      </View>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text allowFontScaling style={styles.guest} numberOfLines={1}>
            {guest}
          </Text>
          {status ? (
            <Text allowFontScaling style={styles.statusName} numberOfLines={1}>
              {status.name}
            </Text>
          ) : null}
        </View>
        <View style={styles.chips}>
          {status?.code === "change_requested" ? (
            <View style={styles.changeChip}>
              <Text allowFontScaling style={styles.changeChipText}>
                Änderung prüfen
              </Text>
            </View>
          ) : null}
          {tableLabel ? (
            <View style={styles.tableChip}>
              <Text allowFontScaling style={styles.tableChipText}>
                {tableLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text allowFontScaling style={styles.meta} numberOfLines={2}>
          {reservation.party_size}{" "}
          {reservation.party_size === 1 ? "Person" : "Personen"}
          {" · bis "}
          {endLabel}
          {reservation.guest_phone ? ` · ${reservation.guest_phone}` : ""}
          {reservation.guest_email ? ` · ${reservation.guest_email}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: gwadaSpacing.sm,
      minHeight: listRowMinHeight,
      paddingVertical: gwadaSpacing.sm,
      paddingHorizontal: gwadaSpacing.md,
    },
    rowPressed: {
      opacity: 0.85,
    },
    stripe: {
      width: 3,
      borderRadius: 2,
      marginVertical: 2,
    },
    timeCol: {
      justifyContent: "center",
      minWidth: 52,
    },
    time: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    main: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    titleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: 8,
    },
    guest: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      flexShrink: 1,
    },
    statusName: {
      fontSize: 12,
      color: colors.textMuted,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    changeChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.warningMuted,
    },
    changeChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.warning,
    },
    tableChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: gwadaRadii.button,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tableChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.text,
    },
    meta: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
}
