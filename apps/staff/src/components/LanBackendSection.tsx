import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/src/components/Button";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { FormTextField } from "@/src/components/ui/FormTextField";
import { getStaffEndpointSummary } from "@/src/lib/env";
import {
  clearStaffLanHost,
  getRuntimeLanHost,
  initStaffLanHost,
  setStaffLanHost,
} from "@/src/lib/staff-lan-host";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

type Props = {
  /** Nach Speichern z. B. Fehlermeldung auf Login zurücksetzen. */
  onEndpointsChanged?: () => void;
};

/**
 * preview-lan: Mac-IP im WLAN — überschreibt eingebaute EAS-URLs ohne neuen Build.
 */
export function LanBackendSection({ onEndpointsChanged }: Props) {
  const styles = useThemedStyles(createStyles);
  const [hostInput, setHostInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState(getStaffEndpointSummary());

  const refresh = useCallback(async () => {
    await initStaffLanHost();
    const host = getRuntimeLanHost();
    setActiveHost(host);
    setHostInput(host ?? "");
    setEndpoints(getStaffEndpointSummary());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setStaffLanHost(hostInput);
      await refresh();
      onEndpointsChanged?.();
      setMessage("Gespeichert — gleiches WLAN wie der Mac.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await clearStaffLanHost();
      await refresh();
      onEndpointsChanged?.();
      setMessage("Zurück auf eingebaute Build-URLs.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Zurücksetzen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GroupedSection
      title="Backend im WLAN"
      footer="IP deines Macs (Terminal: Network-URL von pnpm dev). Ports 3000 und 54321 müssen erreichbar sein."
    >
      <GroupedList>
        <View style={styles.fieldWrap}>
          <FormTextField
            label="Mac-IP oder Host"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="192.168.178.94"
            value={hostInput}
            onChangeText={setHostInput}
          />
        </View>
      </GroupedList>

      <View style={styles.actions}>
        <Button label="Speichern" loading={saving} onPress={() => void handleSave()} />
        {activeHost ? (
          <Button
            label="Build-URLs verwenden"
            variant="secondary"
            disabled={saving}
            onPress={() => void handleReset()}
          />
        ) : null}
      </View>

      <Text allowFontScaling style={styles.hint}>
        API: {endpoints.gwadaApiUrl}
        {"\n"}
        Supabase: {endpoints.supabaseUrl}
      </Text>

      {message ? (
        <Text allowFontScaling style={styles.message}>
          {message}
        </Text>
      ) : null}
    </GroupedSection>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    fieldWrap: { paddingHorizontal: gwadaSpacing.md },
    actions: { gap: gwadaSpacing.sm, marginTop: gwadaSpacing.md },
    hint: {
      marginTop: gwadaSpacing.sm,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
    },
    message: {
      marginTop: gwadaSpacing.sm,
      fontSize: 14,
      color: colors.text,
    },
  });
}
