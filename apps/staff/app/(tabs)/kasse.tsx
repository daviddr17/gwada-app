import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { ReceiptViewerModal } from "@/src/components/ReceiptViewerModal";
import { SkeletonList } from "@/src/components/Skeleton";
import { Card, ScreenHeader } from "@/src/components/ui";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { useStaffPermissions } from "@/src/lib/hooks/use-staff-permissions";
import {
  closeRegister,
  downloadSessionDsfinvkZip,
  fetchRegisterStatus,
  fetchXReportPdf,
  fetchZReportPdf,
  listRegisterSessions,
  openRegister,
  type RegisterSessionSummary,
} from "@/src/lib/pos-api";
import { parseEuroToCents } from "@/src/lib/money-input";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaSpacing } from "@/src/theme/tokens";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export default function KasseScreen() {
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const { has, loading: permsLoading } = useStaffPermissions();
  const canManage = has("pos.kasse.manage");
  const canExport = has("pos.kasse.export");

  const [openingInput, setOpeningInput] = useState("");
  const [closingInput, setClosingInput] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sharingSessionId, setSharingSessionId] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastClosedSessionId, setLastClosedSessionId] = useState<string | null>(
    null,
  );

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["register-status", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: () => fetchRegisterStatus(restaurantId!),
  });

  const {
    data: closedSessions = [],
    refetch: refetchSessions,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ["register-sessions", restaurantId],
    enabled: Boolean(restaurantId) && canExport,
    queryFn: () => listRegisterSessions(restaurantId!, 30),
  });

  const showSkeleton = useDeferredSkeleton(isLoading || permsLoading);

  const handleError = (err: unknown, fallback: string) => {
    Alert.alert("Fehler", posApiErrorMessage(err, fallback));
  };

  const handleOpen = async () => {
    if (!restaurantId) return;
    const cents = parseEuroToCents(openingInput);
    if (cents == null) {
      Alert.alert("Anfangsbestand", "Bitte einen gültigen Betrag eingeben.");
      return;
    }
    setBusy("open");
    try {
      await openRegister({ restaurantId, openingCashCents: cents });
      setOpeningInput("");
      await refetch();
    } catch (err) {
      handleError(err, "Kasse konnte nicht geöffnet werden.");
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async () => {
    if (!restaurantId) return;
    const cents = parseEuroToCents(closingInput);
    if (cents == null) {
      Alert.alert("Endbestand", "Bitte einen gültigen Betrag eingeben.");
      return;
    }
    const expected = data?.aggregate?.expectedCashCents;
    const expectedHint =
      expected != null ? `\nSoll Bar: ${formatCentsEUR(expected)}` : "";

    Alert.alert(
      "Kasse schließen",
      `Endbestand: ${formatCentsEUR(cents)}${expectedHint}\n\nZ-Bon wird an Fiskaly übermittelt.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Schließen",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy("close");
              try {
                const result = await closeRegister({
                  restaurantId,
                  closingCashCents: cents,
                });
                setClosingInput("");
                setLastClosedSessionId(result.sessionId);
                await refetch();
                if (canExport) {
                  void refetchSessions();
                  const z = await fetchZReportPdf(restaurantId, result.sessionId);
                  setPdfTitle(`Z-Bon ${result.zNr}`);
                  setPdfUrl(z.pdfUrl);
                }
              } catch (err) {
                handleError(err, "Kassenabschluss fehlgeschlagen.");
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleXReport = async () => {
    if (!restaurantId) return;
    setBusy("x");
    try {
      const result = await fetchXReportPdf(restaurantId);
      setPdfTitle("X-Bericht");
      setPdfUrl(result.pdfUrl);
    } catch (err) {
      handleError(err, "X-Bericht konnte nicht erstellt werden.");
    } finally {
      setBusy(null);
    }
  };

  const handleShareSessionExport = async (session: RegisterSessionSummary) => {
    if (!restaurantId) return;
    setSharingSessionId(session.id);
    try {
      const { bytes, filename } = await downloadSessionDsfinvkZip({
        restaurantId,
        sessionId: session.id,
      });
      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      await file.write(new Uint8Array(bytes));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/zip",
          dialogTitle: filename,
        });
      } else {
        Alert.alert("Export", `Gespeichert: ${file.uri}`);
      }
    } catch (err) {
      handleError(err, "DSFinV-K Export konnte nicht geladen werden.");
    } finally {
      setSharingSessionId(null);
    }
  };

  if (!canManage && !canExport && !permsLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ScreenHeader title="Kasse" subtitle="Keine Berechtigung" />
          <Text style={styles.muted}>
            Für Kassenfunktionen brauchst du pos.kasse.manage oder pos.kasse.export.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Kasse"
          subtitle={
            data?.isOpen
              ? `Offen seit ${formatDateTime(data.openedAt)}`
              : "Kasse geschlossen"
          }
        />

        {showSkeleton ? (
          <SkeletonList count={4} />
        ) : (
          <>
            <Card>
              <Text style={styles.cardTitle}>Status</Text>
              <Text style={styles.row}>
                Kasse: {data?.isOpen ? "Geöffnet" : "Geschlossen"}
              </Text>
              {data?.aggregate ? (
                <>
                  <Text style={styles.sectionLabel}>Umsatz (TSE)</Text>
                  <Text style={styles.row}>
                    Umsatz gesamt:{" "}
                    {formatCentsEUR(data.aggregate.totalSalesCents)}
                  </Text>
                  <Text style={styles.row}>
                    Barzahlungen:{" "}
                    {formatCentsEUR(data.aggregate.cashPaymentsCents)}
                  </Text>
                  {data.aggregate.totalNonCashSalesCents > 0 ? (
                    <Text style={styles.row}>
                      davon Unbar:{" "}
                      {formatCentsEUR(data.aggregate.totalNonCashSalesCents)}
                    </Text>
                  ) : null}
                  <Text style={styles.row}>
                    Belege: {data.aggregate.transactionCount}
                  </Text>
                  {data.aggregate.expectedCashCents != null ? (
                    <>
                      <View style={styles.sectionDivider} />
                      <Text style={styles.sectionLabel}>Kassenbestand</Text>
                      {data.openingCashCents != null ? (
                        <Text style={styles.row}>
                          Anfangsbestand:{" "}
                          {formatCentsEUR(data.openingCashCents)}
                        </Text>
                      ) : null}
                      <Text style={styles.row}>
                        + Barzahlungen:{" "}
                        {formatCentsEUR(data.aggregate.cashPaymentsCents)}
                      </Text>
                      <Text style={styles.rowStrong}>
                        = Soll Bar:{" "}
                        {formatCentsEUR(data.aggregate.expectedCashCents)}
                      </Text>
                      <Text style={styles.hint}>
                        Soll Bar = Anfangsbestand + Barzahlungen in dieser
                        Session (ohne Karte/Unbar).
                      </Text>
                    </>
                  ) : null}
                </>
              ) : null}
              {data?.lastClosingZNr != null ? (
                <Text style={styles.muted}>
                  Letzter Z-Bon: Z{data.lastClosingZNr}
                  {data.lastClosingAt
                    ? ` · ${formatDateTime(data.lastClosingAt)}`
                    : ""}
                </Text>
              ) : null}
              <Button
                label="Aktualisieren"
                variant="ghost"
                onPress={() => void refetch()}
                disabled={isRefetching}
                style={styles.gapTop}
              />
            </Card>

            {canManage && !data?.isOpen ? (
              <Card>
                <Text style={styles.cardTitle}>Kasse öffnen</Text>
                <Text style={styles.label}>Anfangsbestand (EUR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  value={openingInput}
                  onChangeText={setOpeningInput}
                />
                <Button
                  label={busy === "open" ? "Öffnet …" : "Kasse öffnen"}
                  onPress={() => void handleOpen()}
                  disabled={busy != null}
                />
              </Card>
            ) : null}

            {canManage && data?.isOpen ? (
              <Card>
                <Text style={styles.cardTitle}>Kasse schließen</Text>
                <Text style={styles.label}>Endbestand gezählt (EUR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  value={closingInput}
                  onChangeText={setClosingInput}
                />
                <View style={styles.btnRow}>
                  {canExport ? (
                    <Button
                      label={busy === "x" ? "Erstelle …" : "X-Bericht"}
                      variant="secondary"
                      onPress={() => void handleXReport()}
                      disabled={busy != null}
                      style={styles.flexBtn}
                    />
                  ) : null}
                  <Button
                    label={busy === "close" ? "Schließt …" : "Kasse schließen"}
                    onPress={() => void handleClose()}
                    disabled={busy != null}
                    style={styles.flexBtn}
                  />
                </View>
              </Card>
            ) : null}

            {canExport && lastClosedSessionId && !data?.isOpen ? (
              <Card>
                <Text style={styles.cardTitle}>Z-Bericht erneut</Text>
                <Button
                  label="Z-Bericht anzeigen"
                  variant="secondary"
                  onPress={() => {
                    if (!restaurantId || !lastClosedSessionId) return;
                    void (async () => {
                      setBusy("z");
                      try {
                        const z = await fetchZReportPdf(
                          restaurantId,
                          lastClosedSessionId,
                        );
                        setPdfTitle("Z-Bericht");
                        setPdfUrl(z.pdfUrl);
                      } catch (err) {
                        handleError(err, "Z-Bericht fehlgeschlagen.");
                      } finally {
                        setBusy(null);
                      }
                    })();
                  }}
                  disabled={busy != null}
                />
              </Card>
            ) : null}

            {canExport ? (
              <Card>
                <Text style={styles.cardTitle}>DSFinV-K Exporte</Text>
                <Text style={styles.muted}>
                  Export wird bei Fiskaly zur Laufzeit geladen (nicht auf dem Server
                  gespeichert) — „ZIP teilen“ kann einige Sekunden dauern.
                </Text>
                {sessionsLoading ? (
                  <SkeletonList count={2} />
                ) : closedSessions.length === 0 ? (
                  <Text style={styles.muted}>Noch keine abgeschlossenen Kassensitzungen.</Text>
                ) : (
                  closedSessions.map((session) => {
                    const dateStr = session.closedAt
                      ? new Date(session.closedAt).toLocaleDateString("de-DE", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—";
                    const diff = session.cashDifferenceCents;
                    const isSharing = sharingSessionId === session.id;

                    return (
                      <View key={session.id} style={styles.sessionRow}>
                        <View style={styles.sessionMeta}>
                          <Text style={styles.sessionDate}>
                            {session.zNr != null ? `Z${session.zNr}` : "Z"} · {dateStr}
                          </Text>
                          {diff != null ? (
                            <Text
                              style={[
                                styles.sessionDiff,
                                diff >= 0 ? styles.diffOk : styles.diffBad,
                              ]}
                            >
                              Differenz {formatCentsEUR(diff)}
                            </Text>
                          ) : null}
                        </View>
                        <Button
                          label={isSharing ? "Lädt …" : "ZIP teilen"}
                          variant="secondary"
                          onPress={() => void handleShareSessionExport(session)}
                          disabled={isSharing}
                        />
                      </View>
                    );
                  })
                )}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>

      {pdfUrl ? (
        <ReceiptViewerModal
          visible
          url={pdfUrl}
          title={pdfTitle}
          onClose={() => setPdfUrl(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: gwadaColors.background },
  container: { padding: gwadaSpacing.lg, gap: gwadaSpacing.md, paddingBottom: 40 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: gwadaColors.text,
    marginBottom: gwadaSpacing.sm,
  },
  row: { fontSize: 15, color: gwadaColors.text, marginBottom: 4 },
  rowStrong: {
    fontSize: 15,
    fontWeight: "600",
    color: gwadaColors.text,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: gwadaColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: gwadaSpacing.xs,
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: gwadaColors.border,
    marginVertical: gwadaSpacing.sm,
  },
  hint: {
    fontSize: 12,
    color: gwadaColors.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },
  muted: { fontSize: 13, color: gwadaColors.textMuted, marginTop: 4 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: gwadaColors.textMuted,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: gwadaColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: gwadaColors.text,
    marginBottom: gwadaSpacing.sm,
    backgroundColor: "#fff",
  },
  btnRow: { flexDirection: "row", gap: 8 },
  flexBtn: { flex: 1 },
  gapTop: { marginTop: gwadaSpacing.sm },
  sessionRow: {
    marginTop: gwadaSpacing.sm,
    paddingTop: gwadaSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: gwadaColors.border,
    gap: gwadaSpacing.sm,
  },
  sessionMeta: { gap: 2 },
  sessionDate: { fontSize: 15, fontWeight: "600", color: gwadaColors.text },
  sessionDiff: { fontSize: 13 },
  diffOk: { color: gwadaColors.success },
  diffBad: { color: gwadaColors.destructive },
});
