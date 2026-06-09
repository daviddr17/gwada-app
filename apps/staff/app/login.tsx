import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const { colors } = useStaffTheme();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Eingabe prüfen", "E-Mail und Passwort eingeben.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      Alert.alert(
        "Anmeldung fehlgeschlagen",
        err instanceof Error ? err.message : "Unbekannter Fehler",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.brand}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logo}
              accessibilityLabel="Gwada Staff"
            />
            <Text style={styles.title}>Gwada Staff</Text>
            <Text style={styles.subtitle}>Mitarbeiter-Login</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>E-Mail</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="name@restaurant.de"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Passwort</Text>
            <TextInput
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              textContentType="password"
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />

            <Button label="Anmelden" loading={loading} onPress={handleSubmit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    container: {
      flex: 1,
      padding: gwadaSpacing.lg,
      justifyContent: "center",
      gap: gwadaSpacing.lg,
    },
    brand: { alignItems: "center", gap: gwadaSpacing.sm },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 18,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: gwadaRadii.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: gwadaSpacing.lg,
      gap: gwadaSpacing.sm,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginTop: gwadaSpacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: gwadaRadii.button,
      paddingHorizontal: gwadaSpacing.md,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
  });
}
