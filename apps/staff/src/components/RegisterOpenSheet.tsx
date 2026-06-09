import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { centsToEuroInput, parseEuroToCents } from "@/src/lib/money-input";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type RegisterOpenSheetProps = {
  visible: boolean;
  suggestedOpeningCashCents: number | null;
  onConfirm: (openingCashCents: number) => void;
  onClose: () => void;
  loading?: boolean;
};

export function RegisterOpenSheet({
  visible,
  suggestedOpeningCashCents,
  onConfirm,
  onClose,
  loading,
}: RegisterOpenSheetProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");

  useEffect(() => {
    if (visible) {
      setInput(
        suggestedOpeningCashCents != null
          ? centsToEuroInput(suggestedOpeningCashCents)
          : "",
      );
    }
  }, [visible, suggestedOpeningCashCents]);

  const handleConfirm = () => {
    const cents = parseEuroToCents(input);
    if (cents == null) return;
    onConfirm(cents);
  };

  const parsed = parseEuroToCents(input);
  const invalid = input.trim().length > 0 && parsed == null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { paddingBottom: insets.bottom + gwadaSpacing.lg }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Kasse öffnen</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Abbrechen</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Die Kasse ist geschlossen. Zähle den Barbestand und gib den
          Anfangsbestand ein, um fortzufahren.
        </Text>

        {suggestedOpeningCashCents != null ? (
          <Text style={styles.suggestion}>
            Vorschlag (Soll Bar): {formatCentsEUR(suggestedOpeningCashCents)}
          </Text>
        ) : null}

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="0,00"
          keyboardType="decimal-pad"
          style={[styles.input, invalid && styles.inputInvalid]}
          autoFocus
        />
        {invalid ? (
          <Text style={styles.error}>Bitte einen gültigen Betrag eingeben.</Text>
        ) : null}

        <Button
          label="Kasse öffnen & fortfahren"
          onPress={handleConfirm}
          loading={loading}
          disabled={parsed == null}
          style={styles.primary}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: gwadaColors.background,
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: gwadaSpacing.lg,
    gap: gwadaSpacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  close: {
    fontSize: 16,
    color: gwadaColors.textMuted,
  },
  hint: {
    fontSize: 15,
    color: gwadaColors.textMuted,
    lineHeight: 22,
  },
  suggestion: {
    fontSize: 14,
    fontWeight: "600",
    color: gwadaColors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: gwadaColors.border,
    borderRadius: gwadaRadii.button,
    backgroundColor: gwadaColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: "600",
    color: gwadaColors.text,
  },
  inputInvalid: {
    borderColor: gwadaColors.destructive,
  },
  error: {
    fontSize: 13,
    color: gwadaColors.destructive,
  },
  primary: {
    marginTop: gwadaSpacing.sm,
  },
});
