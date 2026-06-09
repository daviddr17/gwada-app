import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

type ReservationDetailSheetProps = {
  visible: boolean;
  reservation: TableReservationRow | null;
  onClose: () => void;
};

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

  const guest = reservation
    ? formatReservationGuestLabel(reservation)
    : "";
  const timeLabel = reservation
    ? `${timeFmt.format(new Date(reservation.starts_at))} – ${timeFmt.format(new Date(reservation.ends_at))}`
    : "";
  const partyLabel = reservation
    ? `${reservation.party_size} ${reservation.party_size === 1 ? "Person" : "Personen"}`
    : "";
  const statusColor =
    reservation && isValidHexColor(reservation.status?.color_hex)
      ? reservation.status!.color_hex
      : "#64748b";
  const note = reservation?.notes?.trim() ?? "";

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

          {reservation ? (
            <View style={styles.content}>
              <Text style={styles.guest}>{guest}</Text>
              <Text style={styles.meta}>
                {timeLabel} · {partyLabel}
              </Text>
              {reservation.status ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColor}18` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {reservation.status.name}
                  </Text>
                </View>
              ) : null}
              {note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Notiz</Text>
                  <Text style={styles.noteText}>{note}</Text>
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
            <Text style={styles.dismissText}>Schließen</Text>
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
    meta: {
      fontSize: 16,
      color: colors.textMuted,
      lineHeight: 22,
    },
    statusBadge: {
      alignSelf: "flex-start",
      marginTop: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: gwadaRadii.pill,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "600",
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
