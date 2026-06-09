import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ui";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

export default function RestaurantSelectScreen() {
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useStaffTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Restaurant wählen"
          subtitle="Aktives Workspace-Restaurant für POS und Speisekarte"
        />

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
                      onPress={() => void setActiveRestaurant(item.restaurantId)}
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
  });
}
