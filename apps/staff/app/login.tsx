import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { LanBackendSection } from "@/src/components/LanBackendSection";
import { isLanPreviewBuild } from "@/src/lib/staff-build-profile";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { FormTextField } from "@/src/components/ui/FormTextField";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setFormError("E-Mail und Passwort eingeben.");
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.",
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
            <Text allowFontScaling style={styles.title}>
              Gwada Staff
            </Text>
            <Text allowFontScaling style={styles.subtitle}>
              Mitarbeiter-Login
            </Text>
          </View>

          <GroupedSection title="Anmeldung">
            <GroupedList>
              <FormTextField
                label="E-Mail"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                placeholder="name@restaurant.de"
                value={email}
                onChangeText={setEmail}
              />
              <ListSeparator />
              <FormTextField
                label="Passwort"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
                textContentType="password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
              />
            </GroupedList>
          </GroupedSection>

          {formError ? (
            <Text allowFontScaling style={styles.formError}>
              {formError}
            </Text>
          ) : null}

          <Button label="Anmelden" loading={loading} onPress={handleSubmit} />

          {isLanPreviewBuild() ? (
            <LanBackendSection onEndpointsChanged={() => setFormError(null)} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.groupedBackground },
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
    formError: {
      fontSize: 14,
      color: colors.destructive,
      textAlign: "center",
    },
  });
}
