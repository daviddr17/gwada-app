import { useEffect, useState } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { gwadaColors, gwadaRadii } from "@/src/theme/tokens";

type SkeletonProps = {
  height?: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
  borderRadius?: number;
};

export function Skeleton({
  height = 16,
  width = "100%",
  style,
  borderRadius = gwadaRadii.button,
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { height, width, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={56} borderRadius={gwadaRadii.card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: gwadaColors.accent,
  },
  list: {
    gap: 12,
  },
});
