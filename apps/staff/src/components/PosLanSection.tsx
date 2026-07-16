import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PosLanDeviceRole } from "@gwada/pos-lan";
import { POS_LAN_HUB_PORT } from "@gwada/pos-lan";
import { Button } from "@/src/components/Button";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { FormTextField } from "@/src/components/ui/FormTextField";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import {
  isIpadDevice,
  usePosDeviceRoleStore,
} from "@/src/lib/pos-lan/device-role-store";
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

function roleShortLabel(role: PosLanDeviceRole): string {
  return role === "hub" ? "Kasse (Server)" : "Handgerät";
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
 * Dieselbe Staff-App: Rolle wird am Gerät erkannt (iPad = Server, iPhone = Handgerät).
 */
export function PosLanSection() {
  const styles = useThemedStyles(createStyles);
  const role = usePosDeviceRoleStore((s) => s.role);
  const source = usePosDeviceRoleStore((s) => s.source);
  const detectionLabel = usePosDeviceRoleStore((s) => s.detectionLabel);
  const setRoleManual = usePosDeviceRoleStore((s) => s.setRoleManual);
  const resetToAuto = usePosDeviceRoleStore((s) => s.resetToAuto);
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
  const [showOverride, setShowOverride] = useState(false);

  const refreshLocal = useCallback(async () => {
    await usePosDeviceRoleStore.getState().init();
    await usePosHubHostStore.getState().init();
    setHostInput(usePosHubHostStore.getState().hubHost ?? "");
    setHubPort(getPosHubServerPort());
  }, []);

  useEffect(() => {
    void refreshLocal();
  }, [refreshLocal, role, status, source]);

  const applyAuto = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await resetToAuto();
      await syncPosLanRuntime();
      setMessage("Wieder Automatik — Rolle vom Gerät erkannt.");
      setShowOverride(false);
      await refreshLocal();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Zurücksetzen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const applyManual = async (next: PosLanDeviceRole) => {
    setBusy(true);
    setMessage(null);
    try {
      await setRoleManual(next);
      await syncPosLanRuntime();
      setMessage(
        next === "hub"
          ? "Manuell: dieses Gerät ist die Kasse (Server)."
          : "Manuell: dieses Gerät ist Handgerät.",
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
      <GroupedSection
        title="Kasse im WLAN"
        footer="Dieselbe App auf iPad und iPhone. Ohne Einstellung: iPad = Server, iPhone = Handgerät."
      >
        <GroupedList>
          <ListRow label="Erkennung" value={detectionLabel} variant="value" />
          <ListSeparator />
          <ListRow label="Aktive Rolle" value={roleShortLabel(role)} variant="value" />
          {role === "hub" ? (
            <>
              <ListSeparator />
              <ListRow
                label="Lokaler Server"
                value={
                  hubPort
                    ? `Läuft · Port ${hubPort}${isIpadDevice() ? " · iPad" : ""}`
                    : `Port ${POS_LAN_HUB_PORT} (startet nach Login …)`
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
            </>
          )}
        </GroupedList>
      </GroupedSection>

      {role === "handheld" ? (
        <GroupedSection title="Verbindung zur Kasse">
          <GroupedList>
            <View style={styles.fieldWrap}>
              <FormTextField
                label="Hub-IP (nur Fallback)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                placeholder="192.168.178.40"
                value={hostInput}
                onChangeText={setHostInput}
              />
            </View>
          </GroupedList>
          <View style={styles.actions}>
            <Button
              label="Erneut suchen"
              onPress={() => {
                setBusy(true);
                setMessage(null);
                void bootstrapPosHandheldFromHub(restaurantId)
                  .then(() =>
                    setMessage("Abruf von der Kasse abgeschlossen."),
                  )
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
            <Button
              label="Hub-IP speichern & abrufen"
              variant="secondary"
              onPress={() => void saveHost()}
              disabled={busy || !hostInput.trim()}
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
        </GroupedSection>
      ) : null}

      <GroupedSection title="Rolle (nur bei Bedarf)">
        <GroupedList>
          <ListRow
            label="Steuerung"
            value={source === "auto" ? "Automatisch" : "Manuell überschrieben"}
            variant="value"
          />
        </GroupedList>
        <View style={styles.actions}>
          {source === "manual" ? (
            <Button
              label="Wieder automatisch erkennen"
              onPress={() => void applyAuto()}
              disabled={busy}
            />
          ) : null}
          <Button
            label={showOverride ? "Override ausblenden" : "Manuell überschreiben"}
            variant="secondary"
            onPress={() => setShowOverride((v) => !v)}
            disabled={busy}
          />
          {showOverride ? (
            <View style={styles.roleRow}>
              <Button
                label="Als Kasse"
                variant={role === "hub" ? "primary" : "secondary"}
                onPress={() => void applyManual("hub")}
                disabled={busy}
              />
              <Button
                label="Als Handgerät"
                variant={role === "handheld" ? "primary" : "secondary"}
                onPress={() => void applyManual("handheld")}
                disabled={busy}
              />
            </View>
          ) : null}
        </View>
      </GroupedSection>

      {message ? (
        <Text allowFontScaling style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      gap: gwadaSpacing.sm,
    },
    fieldWrap: {
      paddingHorizontal: gwadaSpacing.md,
    },
    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: gwadaSpacing.sm,
    },
    actions: {
      gap: gwadaSpacing.sm,
      marginTop: gwadaSpacing.md,
    },
    message: {
      color: colors.text,
      fontSize: 14,
      paddingHorizontal: gwadaSpacing.xs,
    },
  });
}
