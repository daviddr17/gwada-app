import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/src/components/Button";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type PinPadProps = {
  title: string;
  subtitle?: string;
  error?: string | null;
  maxLength?: number;
  onComplete: (pin: string) => void | Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
};

export function PinPad({
  title,
  subtitle,
  error,
  maxLength = 6,
  onComplete,
  onCancel,
  cancelLabel = "Abbrechen",
}: PinPadProps) {
  const styles = useThemedStyles(createStyles);
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);

  const append = useCallback(
    (d: string) => {
      if (busy) return;
      setDigits((prev) => {
        if (prev.length >= maxLength) return prev;
        const next = prev + d;
        if (next.length >= 4) {
          void (async () => {
            if (next.length === maxLength || next.length === 4) {
              // allow 4–6: submit on 6 or user taps OK — we auto-submit at 4+ when releasing 4th? 
              // Better: submit only when length >= 4 and user stops — use fixed 4 for v1
            }
          })();
        }
        return next;
      });
    },
    [busy, maxLength],
  );

  const submit = useCallback(
    async (pin: string) => {
      if (pin.length < 4) return;
      setBusy(true);
      try {
        await onComplete(pin);
        setDigits("");
      } finally {
        setBusy(false);
      }
    },
    [onComplete],
  );

  const onDigit = (d: string) => {
    if (busy) return;
    const next = digits + d;
    if (next.length > maxLength) return;
    setDigits(next);
    if (next.length >= 4 && next.length <= 6) {
      // auto-submit at 4 digits (min length)
      if (next.length === 4) void submit(next);
    }
  };

  const backspace = () => {
    if (busy) return;
    setDigits((p) => p.slice(0, -1));
  };

  const dots = Array.from({ length: maxLength }, (_, i) => i < digits.length);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text allowFontScaling style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text allowFontScaling style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.dotsRow}>
          {dots.map((filled, i) => (
            <View
              key={i}
              style={[styles.dot, filled && styles.dotFilled]}
            />
          ))}
        </View>
        {error ? (
          <Text allowFontScaling style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={styles.pad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
            (key, idx) => {
              if (key === "") {
                return <View key={`sp-${idx}`} style={styles.padKey} />;
              }
              const isBack = key === "⌫";
              return (
                <Pressable
                  key={key}
                  style={styles.padKey}
                  onPress={() => (isBack ? backspace() : onDigit(key))}
                  accessibilityRole="button"
                  accessibilityLabel={isBack ? "Löschen" : `Ziffer ${key}`}
                >
                  <Text style={styles.padKeyText}>{key}</Text>
                </Pressable>
              );
            },
          )}
        </View>
        {digits.length >= 4 && digits.length < 6 ? (
          <Button
            label="Bestätigen"
            loading={busy}
            onPress={() => void submit(digits)}
          />
        ) : null}
        {onCancel ? (
          <Button variant="ghost" label={cancelLabel} onPress={onCancel} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.xl,
      gap: gwadaSpacing.md,
      alignItems: "center",
    },
    title: { fontSize: 22, fontWeight: "700", color: colors.text },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
    },
    dotsRow: { flexDirection: "row", gap: 12, marginVertical: gwadaSpacing.lg },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.separator,
    },
    dotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
    error: { color: colors.destructive, fontSize: 14, textAlign: "center" },
    pad: {
      flexDirection: "row",
      flexWrap: "wrap",
      width: 280,
      justifyContent: "center",
      gap: 8,
      marginTop: gwadaSpacing.md,
    },
    padKey: {
      width: 80,
      height: 56,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.fillSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    padKeyText: { fontSize: 24, fontWeight: "600", color: colors.text },
  });
}
