import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { Card, ScreenHeader } from "@/src/components/ui";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaSpacing } from "@/src/theme/tokens";

export default function SettingsScreen() {
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const active = restaurants.find((r) => r.restaurantId === activeRestaurantId);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader title="Einstellungen" />

        <Card>
          <Text style={styles.label}>Angemeldet als</Text>
          <Text style={styles.value}>{session?.user.email ?? "—"}</Text>

          <Text style={[styles.label, styles.gapTop]}>Aktives Restaurant</Text>
          <Text style={styles.value}>{active?.name ?? "—"}</Text>
        </Card>

        <Button
          label="Restaurant wechseln"
          variant="secondary"
          onPress={() => {
            useAuthStore.setState({ activeRestaurantId: null });
          }}
          style={styles.btn}
        />

        <Button label="Abmelden" variant="ghost" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: gwadaColors.background },
  container: { flex: 1, padding: gwadaSpacing.lg, gap: gwadaSpacing.md },
  label: { fontSize: 13, color: gwadaColors.textMuted, fontWeight: "600" },
  value: { fontSize: 16, color: gwadaColors.text, marginTop: 4 },
  gapTop: { marginTop: gwadaSpacing.md },
  btn: { marginTop: gwadaSpacing.sm },
});
