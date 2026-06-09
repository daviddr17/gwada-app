import { StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import type { SessionFloorMeta } from "@/src/lib/dining-floor";
import {
  formatOpenedSinceShort,
  useOccupiedDuration,
} from "@/src/lib/hooks/use-occupied-duration";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

type TableOccupiedMetaProps = {
  openedAt: string;
  meta: SessionFloorMeta | undefined;
};

export function TableOccupiedMeta({ openedAt, meta }: TableOccupiedMetaProps) {
  const duration = useOccupiedDuration(openedAt);
  const styles = useThemedStyles(createStyles);
  const orderCount = meta?.orderCount ?? 0;
  const openCents = meta?.openCents ?? 0;

  const activityParts: string[] = [];
  if (orderCount > 0) {
    activityParts.push(
      `${orderCount} ${orderCount === 1 ? "Bestellung" : "Bestellungen"}`,
    );
  } else {
    activityParts.push("Keine Bestellungen");
  }
  if (openCents > 0) {
    activityParts.push(`Offen ${formatCentsEUR(openCents)}`);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.timeLine}>
        Seit {formatOpenedSinceShort(openedAt)} · {duration}
      </Text>
      <Text style={styles.activityLine}>{activityParts.join(" · ")}</Text>
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      marginTop: gwadaSpacing.sm,
      gap: 2,
    },
    timeLine: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    activityLine: {
      fontSize: 13,
      color: colors.textMuted,
    },
  });
}
