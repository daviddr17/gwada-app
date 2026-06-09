import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { Card, ScreenHeader } from "@/src/components/ui";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

export default function RestaurantSelectScreen() {
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const signOut = useAuthStore((s) => s.signOut);
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader
          title="Restaurant wählen"
          subtitle="Aktives Workspace-Restaurant für POS und Speisekarte"
        />

        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.restaurantId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Kein Restaurant mit Staff-Zugang gefunden.
            </Text>
          }
          renderItem={({ item }) => {
            const active = item.restaurantId === activeRestaurantId;
            return (
              <Card>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.slug}>{item.slug}</Text>
                <Button
                  label={active ? "Aktiv" : "Auswählen"}
                  variant={active ? "secondary" : "primary"}
                  onPress={() => void setActiveRestaurant(item.restaurantId)}
                  style={{ marginTop: gwadaSpacing.sm }}
                />
              </Card>
            );
          }}
        />

        <Button label="Abmelden" variant="ghost" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: gwadaSpacing.lg },
    list: { gap: 12, paddingBottom: gwadaSpacing.lg },
    name: { fontSize: 18, fontWeight: "600", color: colors.text },
    slug: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
    empty: { color: colors.textMuted, textAlign: "center", padding: 24 },
  });
}
