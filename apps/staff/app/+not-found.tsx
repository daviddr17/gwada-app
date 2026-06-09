import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";

export default function NotFoundScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <>
      <Stack.Screen options={{ title: "Nicht gefunden" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Diese Seite existiert nicht.</Text>
        <Link href="/login" style={styles.link}>
          <Text style={styles.linkText}>Zum Login</Text>
        </Link>
      </View>
    </>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    link: { marginTop: 16 },
    linkText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  });
}
