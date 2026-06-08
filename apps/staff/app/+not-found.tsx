import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { gwadaColors } from "@/src/theme/tokens";

export default function NotFoundScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: gwadaColors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  link: { marginTop: 16 },
  linkText: { fontSize: 16, color: gwadaColors.accent, fontWeight: "600" },
});
