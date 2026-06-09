import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { SheetChrome } from "@/src/components/sheets/SheetChrome";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { FormTextField } from "@/src/components/ui/FormTextField";
import { centsToEuroInput, parseEuroToCents } from "@/src/lib/money-input";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

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
  const styles = useThemedStyles(createStyles);
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
      <SheetChrome
        title="Kasse öffnen"
        onClose={onClose}
        closeLabel="Abbrechen"
        footer={
          <Button
            label="Kasse öffnen & fortfahren"
            onPress={handleConfirm}
            loading={loading}
            disabled={parsed == null}
          />
        }
      >
        <Text allowFontScaling style={styles.hint}>
          Zähle den Barbestand und gib den Anfangsbestand ein, um fortzufahren.
        </Text>

        {suggestedOpeningCashCents != null ? (
          <Text allowFontScaling style={styles.suggestion}>
            Vorschlag (Soll Bar): {formatCentsEUR(suggestedOpeningCashCents)}
          </Text>
        ) : null}

        <GroupedList>
          <FormTextField
            label="Anfangsbestand (EUR)"
            value={input}
            onChangeText={setInput}
            placeholder="0,00"
            keyboardType="decimal-pad"
            error={invalid ? "Bitte einen gültigen Betrag eingeben." : undefined}
          />
        </GroupedList>
      </SheetChrome>
    </Modal>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    hint: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: gwadaSpacing.sm,
    },
    suggestion: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: gwadaSpacing.md,
    },
  });
}
