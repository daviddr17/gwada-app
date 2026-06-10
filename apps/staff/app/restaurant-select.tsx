import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanBackendSection } from "@/src/components/LanBackendSection";
import { isLanPreviewBuild } from "@/src/lib/staff-build-profile";
import { ScreenHeader } from "@/src/components/ui";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing, screenTypography } from "@/src/theme/tokens";

export default function RestaurantSelectScreen() {
  const router = useRouter();
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useStaffTheme();
  const styles = useThemedStyles(createStyles);

  const switching = Boolean(activeRestaurantId);

  const handleSelectRestaurant = async (restaurantId: string) => {
    await setActiveRestaurant(restaurantId);
    if (switching) {
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: switching,
          title: "Restaurant wählen",
          headerBackTitle: "Menü",
        }}
      />
      <SafeAreaView style={styles.safe} edges={switching ? ["bottom"] : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          {switching ? (
            <Text allowFontScaling style={styles.subtitle}>
              Aktives Workspace-Restaurant für POS und Speisekarte
            </Text>
          ) : (
            <ScreenHeader
              title="Restaurant wählen"
              subtitle="Aktives Workspace-Restaurant für POS und Speisekarte"
            />
          )}

        <GroupedSection title="Restaurants">
          {restaurants.length === 0 ? (
            <Text allowFontScaling style={styles.empty}>
              Kein Restaurant mit Staff-Zugang gefunden.
            </Text>
          ) : (
            <GroupedList>
              {restaurants.map((item, index) => {
                const active = item.restaurantId === activeRestaurantId;
                return (
                  <View key={item.restaurantId}>
                    {index > 0 ? <ListSeparator /> : null}
                    <ListRow
                      label={item.name}
                      value={item.slug}
                      variant="value"
                      onPress={() => void handleSelectRestaurant(item.restaurantId)}
                      accessory={
                        active ? (
                          <Ionicons
                            name="checkmark"
                            size={22}
                            color={colors.accent}
                          />
                        ) : undefined
                      }
                    />
                  </View>
                );
              })}
            </GroupedList>
          )}
        </GroupedSection>

        {isLanPreviewBuild() ? <LanBackendSection /> : null}

        <GroupedSection style={styles.signOutSection}>
          <GroupedList>
            <ListRow
              label="Abmelden"
              variant="destructive"
              onPress={() => void signOut()}
            />
          </GroupedList>
        </GroupedSection>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.groupedBackground },
    container: {
      padding: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.xl,
      gap: gwadaSpacing.lg,
    },
    empty: {
      color: colors.textMuted,
      textAlign: "center",
      padding: gwadaSpacing.lg,
    },
    signOutSection: {
      marginTop: gwadaSpacing.md,
    },
    subtitle: {
      ...screenTypography.subtitle,
      color: colors.textMuted,
      marginBottom: gwadaSpacing.md,
    },
  });
}
