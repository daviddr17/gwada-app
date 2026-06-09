import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type ReceiptViewerModalProps = {
  visible: boolean;
  url: string;
  title: string;
  onClose: () => void;
};

export function ReceiptViewerModal({
  visible,
  url,
  title,
  onClose,
}: ReceiptViewerModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useStaffTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [sharing, setSharing] = useState(false);

  const activeUrl = retryKey > 0 ? `${url}${url.includes("?") ? "&" : "?"}t=${retryKey}` : url;

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const cleanUrl = url.split("?")[0];
      const last8 = cleanUrl.slice(-8).replace(/[^a-zA-Z0-9]/g, "_");
      const destFile = new File(Paths.cache, `beleg-${last8}.pdf`);
      const localUri = destFile.exists
        ? destFile.uri
        : (await File.downloadFileAsync(url, destFile)).uri;
      await Sharing.shareAsync(localUri, {
        mimeType: "application/pdf",
        dialogTitle: title,
      });
    } catch {
      Alert.alert("Fehler", "PDF konnte nicht geteilt werden.");
    } finally {
      setSharing(false);
    }
  }, [url, title]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={onClose}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityLabel="Schließen"
        >
          <Text style={styles.headerBtnText}>Schließen</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => void handleShare()}
          style={[styles.headerBtn, (sharing || loading) && styles.headerBtnDisabled]}
          disabled={sharing || loading}
          hitSlop={8}
          accessibilityLabel="Teilen"
        >
          {sharing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.shareText}>Teilen</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.webviewContainer, { paddingBottom: insets.bottom }]}>
        {hasError ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Beleg konnte nicht geladen werden.</Text>
            <Pressable style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Erneut versuchen</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WebView
              key={retryKey}
              source={{ uri: activeUrl }}
              style={styles.webview}
              onLoadStart={() => {
                setLoading(true);
                setHasError(false);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
              onHttpError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: gwadaSpacing.md,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      minWidth: 72,
      alignItems: "center",
    },
    headerBtnDisabled: {
      opacity: 0.35,
    },
    headerBtnText: {
      fontSize: 14,
      color: colors.text,
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    shareText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    webviewContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    webview: {
      flex: 1,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    errorState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: gwadaSpacing.md,
      paddingHorizontal: gwadaSpacing.xl,
    },
    errorText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
    },
    retryBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: gwadaSpacing.lg,
      paddingVertical: 10,
      borderRadius: gwadaRadii.button,
    },
    retryBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accentForeground,
    },
  });
}
