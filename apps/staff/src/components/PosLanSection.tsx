import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { PosLanDeviceRole } from "@gwada/pos-lan";
import { POS_LAN_HUB_PORT } from "@gwada/pos-lan";
import { Button } from "@/src/components/Button";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { FormTextField } from "@/src/components/ui/FormTextField";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { usePosDeviceRoleStore } from "@/src/lib/pos-lan/device-role-store";
import { usePosHubConnectionStore } from "@/src/lib/pos-lan/hub-connection-store";
import { usePosHubHostStore } from "@/src/lib/pos-lan/hub-host-store";
import {
  bootstrapPosHandheldFromHub,
  getPosHubServerPort,
  syncPosLanRuntime,
} from "@/src/lib/pos-lan/hub-runtime";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

function roleLabel(role: PosLanDeviceRole): string {
  return role === "hub" ? "iPad-Kasse (Hub)" : "Handgerät (iPhone)";
}

function connectionLabel(
  status: ReturnType<typeof usePosHubConnectionStore.getState>["status"],
  lastError: string | null,
): string {
  switch (status) {
    case "connected":
      return "Mit Kasse verbunden";
    case "searching":
      return "Suche Kasse im WLAN …";
    case "connecting":
      return "Verbinde mit Kasse …";
    case "error":
      return lastError ?? "Kasse nicht erreichbar";
    default:
      return "—";
  }
}

/**
 * Geräte-Rolle + LAN-Hub (iPad-Kasse ↔ iPhone-Handgeräte).
 */
export function PosLanSection() {
  const styles = useThemedStyles(createStyles);
  const role = usePosDeviceRoleStore((s) => s.role);
  const setRole = usePosDeviceRoleStore((s) => s.setRole);
  const hubHost = usePosHubHostStore((s) => s.hubHost);
  const setHubHost = usePosHubHostStore((s) => s.setHubHost);
  const clearHubHost = usePosHubHostStore((s) => s.clearHubHost);
  const status = usePosHubConnectionStore((s) => s.status);
  const hubBaseUrl = usePosHubConnectionStore((s) => s.hubBaseUrl);
  const lastError = usePosHubConnectionStore((s) => s.lastError);
  const lastFetchedAt = usePosHubConnectionStore((s) => s.lastFetchedAt);

  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const [hostInput, setHostInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hubPort, setHubPort] = useState<number | null>(null);

  const refreshLocal = useCallback(async () => {
    await usePosDeviceRoleStore.getState().init();
    await usePosHubHostStore.getState().init();
    setHostInput(usePosHubHostStore.getState().hubHost ?? "");
    setHubPort(getPosHubServerPort());
  }, []);

  useEffect(() => {
    void refreshLocal();
  }, [refreshLocal, role, status]);

  const applyRole = async (next: PosLanDeviceRole) => {
    setBusy(true);
    setMessage(null);
    try {
      await setRole(next);
      await syncPosLanRuntime();
      setMessage(
        next === "hub"
          ? "Dieses Gerät ist jetzt die Kasse (Hub)."
          : "Dieses Gerät holt Daten von der Kasse.",
      );
      await refreshLocal();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Rollenwechsel fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const saveHost = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await setHubHost(hostInput);
      await syncPosLanRuntime();
      setMessage("Hub-Adresse gespeichert — Abruf von der Kasse.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <GroupedSection title="Kasse im WLAN">
        <GroupedList>
          <ListRow
            label="Rolle"
            value={roleLabel(role)}
            variant="value"
          />
          <ListSeparator />
          <View style={styles.roleRow}>
            <Button
              label="Als Kasse"
              variant={role === "hub" ? "primary" : "secondary"}
              onPress={() => void applyRole("hub")}
              disabled={busy}
            />
            <Button
              label="Als Handgerät"
              variant={role === "handheld" ? "primary" : "secondary"}
              onPress={() => void applyRole("handheld")}
              disabled={busy}
            />
          </View>
          {role === "hub" ? (
            <>
              <ListSeparator />
              <ListRow
                label="Lokaler Server"
                value={
                  hubPort
                    ? `Port ${hubPort} · ${
                        Platform.OS === "ios" &&
                        Boolean((Platform as { isPad?: boolean }).isPad)
                          ? "iPad"
                          : "Gerät"
                      }`
                    : `Port ${POS_LAN_HUB_PORT} (wird gestartet …)`
                }
                variant="value"
              />
            </>
          ) : (
            <>
              <ListSeparator />
              <ListRow
                label="Status"
                value={connectionLabel(status, lastError)}
                variant="value"
              />
              {hubBaseUrl ? (
                <>
                  <ListSeparator />
                  <ListRow label="Hub" value={hubBaseUrl} variant="value" />
                </>
              ) : null}
              {lastFetchedAt ? (
                <>
                  <ListSeparator />
                  <ListRow
                    label="Letzter Abruf"
                    value={new Date(lastFetchedAt).toLocaleString("de-DE")}
                    variant="value"
                  />
                </>
              ) : null}
              <ListSeparator />
              <FormTextField
                label="Hub-IP (Fallback)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                placeholder="192.168.178.40"
                value={hostInput}
                onChangeText={setHostInput}
              />
              <View style={styles.actions}>
                <Button
                  label="Hub speichern & abrufen"
                  onPress={() => void saveHost()}
                  disabled={busy || !hostInput.trim()}
                />
                <Button
                  label="Erneut suchen"
                  variant="secondary"
                  onPress={() => {
                    setBusy(true);
                    setMessage(null);
                    void bootstrapPosHandheldFromHub(restaurantId)
                      .then(() => setMessage("Abruf von der Kasse abgeschlossen."))
                      .catch((err) =>
                        setMessage(
                          err instanceof Error
                            ? err.message
                            : "Suche fehlgeschlagen.",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                  disabled={busy}
                />
                {hubHost ? (
                  <Button
                    label="Gespeicherte IP löschen"
                    variant="secondary"
                    onPress={() => {
                      void clearHubHost().then(() => syncPosLanRuntime());
                    }}
                    disabled={busy}
                  />
                ) : null}
              </View>
            </>
          )}
        </GroupedList>
      </GroupedSection>
      {message ? (
        <Text allowFontScaling style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Text allowFontScaling style={styles.hint}>
        iPad startet den Server im Hintergrund und wirbt per Bonjour. iPhones
        holen beim Start den Snapshot von der Kasse über das lokale WLAN.
      </Text>
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      gap: gwadaSpacing.sm,
    },
    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: gwadaSpacing.sm,
      paddingHorizontal: gwadaSpacing.md,
      paddingVertical: gwadaSpacing.sm,
    },
    actions: {
      gap: gwadaSpacing.sm,
      paddingHorizontal: gwadaSpacing.md,
      paddingVertical: gwadaSpacing.sm,
    },
    message: {
      color: colors.text,
      fontSize: 14,
      paddingHorizontal: gwadaSpacing.xs,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: gwadaSpacing.xs,
    },
  });
}
