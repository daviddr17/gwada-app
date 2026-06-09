import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  reservationDetailFromListRow,
  reservationDetailFromTableRow,
  reservationDetailGuestLabel,
  type ReservationDetailData,
} from "@/src/lib/reservations/reservation-detail";
import type { TableReservationRow } from "@/src/lib/dining-floor";
import type { ReservationListRow } from "@/src/lib/reservations/reservations-db";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

type ReservationDetailSheetProps = {
  visible: boolean;
  reservation: TableReservationRow | ReservationListRow | ReservationDetailData | null;
  onClose: () => void;
};

function normalizeDetail(
  reservation: TableReservationRow | ReservationListRow | ReservationDetailData,
): ReservationDetailData {
  if ("reservationNumber" in reservation) {
    return reservation;
  }
  if ("reservation_statuses" in reservation) {
    return reservationDetailFromListRow(reservation);
  }
  return reservationDetailFromTableRow(reservation);
}

function isValidHexColor(hex: string | undefined): boolean {
  return Boolean(hex && /^#[0-9A-Fa-f]{6}$/i.test(hex));
}

export function ReservationDetailSheet({
  visible,
  reservation,
  onClose,
}: ReservationDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  const detail = reservation ? normalizeDetail(reservation) : null;
  const guest = detail ? reservationDetailGuestLabel(detail) : "";
  const timeLabel = detail
    ? `${timeFmt.format(new Date(detail.starts_at))} – ${timeFmt.format(new Date(detail.ends_at))}`
    : "";
  const partyLabel = detail
    ? `${detail.party_size} ${detail.party_size === 1 ? "Person" : "Personen"}`
    : "";
  const statusColor =
    detail && isValidHexColor(detail.status?.color_hex)
      ? detail.status!.color_hex
      : "#64748b";
  const note = detail?.notes?.trim() ?? "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTap}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        />
        <View
          style={[
            styles.card,
            { paddingBottom: insets.bottom + gwadaSpacing.lg },
          ]}
        >
          <View style={styles.handle} />

          {detail ? (
            <View style={styles.content}>
              <Text allowFontScaling style={styles.guest}>
                {guest}
              </Text>
              {detail.reservationNumber != null ? (
                <Text allowFontScaling style={styles.number}>
                  Reservierung #{detail.reservationNumber}
                </Text>
              ) : null}
              <Text allowFontScaling style={styles.meta}>
                {timeLabel} · {partyLabel}
              </Text>
              {detail.status ? (
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${statusColor}18` },
                    ]}
                  >
                    <Text
                      allowFontScaling
                      style={[styles.statusText, { color: statusColor }]}
                    >
                      {detail.status.name}
                    </Text>
                  </View>
                  {detail.status.code === "change_requested" ? (
                    <View style={styles.changeChip}>
                      <Text allowFontScaling style={styles.changeChipText}>
                        Änderung prüfen
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {detail.tableLabel ? (
                <Text allowFontScaling style={styles.tableLabel}>
                  Tisch: {detail.tableLabel}
                </Text>
              ) : null}
              {detail.guest_phone ? (
                <Text allowFontScaling style={styles.contact}>
                  {detail.guest_phone}
                </Text>
              ) : null}
              {detail.guest_email ? (
                <Text allowFontScaling style={styles.contact}>
                  {detail.guest_email}
                </Text>
              ) : null}
              {note ? (
                <View style={styles.noteBox}>
                  <Text allowFontScaling style={styles.noteLabel}>
                    Notiz
                  </Text>
                  <Text allowFontScaling style={styles.noteText}>
                    {note}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dismissBtn,
              pressed && styles.dismissBtnPressed,
            ]}
            hitSlop={8}
          >
            <Text allowFontScaling style={styles.dismissText}>
              Schließen
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    backdropTap: {
      flex: 1,
    },
    card: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: gwadaRadii.card + 4,
      borderTopRightRadius: gwadaRadii.card + 4,
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.sm,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.fillSecondary,
      marginBottom: gwadaSpacing.md,
    },
    content: {
      gap: 8,
      marginBottom: gwadaSpacing.md,
    },
    guest: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.3,
    },
    number: {
      fontSize: 14,
      color: colors.textMuted,
    },
    meta: {
      fontSize: 16,
      color: colors.textMuted,
      lineHeight: 22,
    },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: gwadaRadii.pill,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "600",
    },
    changeChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.warningMuted,
    },
    changeChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.warning,
    },
    tableLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    contact: {
      fontSize: 15,
      color: colors.textMuted,
    },
    noteBox: {
      marginTop: 4,
      padding: gwadaSpacing.sm,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    noteLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    noteText: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 21,
    },
    dismissBtn: {
      alignItems: "center",
      paddingVertical: gwadaSpacing.sm,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dismissBtnPressed: {
      opacity: 0.88,
    },
    dismissText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
  });
}
