import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DiningAreaRow } from "@/src/lib/dining-floor";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

/** Chip padding + border + label line — ScrollView braucht explizite Höhe, sonst clippt iOS oben. */
const CHIP_ROW_HEIGHT = 36;

type DiningAreaFilterProps = {
  areas: DiningAreaRow[];
  activeAreaId: string | null;
  onAreaSelect: (areaId: string) => void;
};

export function DiningAreaFilter({
  areas,
  activeAreaId,
  onAreaSelect,
}: DiningAreaFilterProps) {
  if (areas.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
      >
        {areas.map((area) => {
          const active = area.id === activeAreaId;
          const accent = area.color_hex?.trim() || gwadaColors.accent;
          return (
            <Pressable
              key={area.id}
              onPress={() => onAreaSelect(area.id)}
              style={[
                styles.chip,
                active && { borderColor: accent, backgroundColor: `${accent}18` },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text
                numberOfLines={1}
                style={[styles.chipLabel, active && styles.chipLabelActive]}
              >
                {area.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: -gwadaSpacing.lg,
    marginBottom: gwadaSpacing.sm,
    overflow: "visible",
  },
  scroller: {
    flexGrow: 0,
    height: CHIP_ROW_HEIGHT + 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: CHIP_ROW_HEIGHT + 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: gwadaRadii.pill,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    backgroundColor: gwadaColors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: gwadaColors.textMuted,
    flexShrink: 0,
  },
  chipLabelActive: {
    color: gwadaColors.text,
    fontWeight: "600",
  },
});
