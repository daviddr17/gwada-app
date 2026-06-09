import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { SessionMiniHeader } from "@/src/components/SessionMiniHeader";
import { SessionTabBar, type SessionTab } from "@/src/components/SessionTabBar";
import {
  sessionMiniOpacity,
  sessionStatsOpacity,
} from "@/src/lib/session-header-collapse";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

const MINI_ROW_HEIGHT = 44;
const TAB_BLOCK_HEIGHT = 44;

type SessionFloatingChromeProps = {
  scrollY: SharedValue<number>;
  contentOffsetY: SharedValue<number>;
  statsBlockHeight: SharedValue<number>;
  tableLabel: string;
  openCents: number;
  openedAt: string;
  tab: SessionTab;
  paymentCount: number;
  onTabChange: (tab: SessionTab) => void;
  onExpand: () => void;
};

type SessionAnimatedStatsBlockProps = {
  scrollY: SharedValue<number>;
  statsBlockHeight: SharedValue<number>;
  children: ReactNode;
  onLayout: (height: number) => void;
};

/** Fades stats while they scroll under tab chrome — no overlap with mini KPI. */
export function SessionAnimatedStatsBlock({
  scrollY,
  statsBlockHeight,
  children,
  onLayout,
}: SessionAnimatedStatsBlockProps) {
  const statsStyle = useAnimatedStyle(() => ({
    opacity: sessionStatsOpacity(scrollY.value, statsBlockHeight.value),
  }));

  return (
    <Animated.View
      style={statsStyle}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0) onLayout(next);
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Tabs + mini KPI — translateY tracks stats block; mini only after stats are gone. */
export function SessionFloatingChrome({
  scrollY,
  contentOffsetY,
  statsBlockHeight,
  tableLabel,
  openCents,
  openedAt,
  tab,
  paymentCount,
  onTabChange,
  onExpand,
}: SessionFloatingChromeProps) {
  const styles = useThemedStyles(createStyles);

  const chromeStyle = useAnimatedStyle(() => {
    const statsH = statsBlockHeight.value;
    // Use unclamped offset so tabs follow pull-to-refresh (negative contentOffset).
    const y = Math.max(0, statsH - contentOffsetY.value);
    return {
      transform: [{ translateY: y }],
    };
  });

  const miniStyle = useAnimatedStyle(() => {
    const statsH = statsBlockHeight.value;
    return {
      opacity: sessionMiniOpacity(scrollY.value, statsH),
    };
  });

  return (
    <Animated.View
      style={[styles.chrome, chromeStyle]}
      pointerEvents="box-none"
    >
      <View style={styles.chromeInner} pointerEvents="box-none">
        <Animated.View style={[styles.miniOverlay, miniStyle]}>
          <SessionMiniHeader
            tableLabel={tableLabel}
            openCents={openCents}
            openedAt={openedAt}
            onPress={onExpand}
          />
        </Animated.View>
        <SessionTabBar
          active={tab}
          onChange={onTabChange}
          paymentCount={paymentCount}
        />
      </View>
    </Animated.View>
  );
}

/** Reserve space in ListHeaderComponent so tabs do not cover list rows. */
export function SessionChromeSpacer() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.spacer} />;
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    chrome: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    chromeInner: {
      position: "relative",
    },
    miniOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "100%",
      marginBottom: gwadaSpacing.sm,
      height: MINI_ROW_HEIGHT,
      justifyContent: "center",
    },
    spacer: {
      height: TAB_BLOCK_HEIGHT + gwadaSpacing.lg + gwadaSpacing.sm,
    },
  });
}
