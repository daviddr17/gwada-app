import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  createMolliePayment,
  recheckMolliePayment,
  type MolliePaymentMethod,
} from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

type MollieCheckoutModalProps = {
  visible: boolean;
  checkoutUrl: string | null;
  molliePaymentId: string | null;
  restaurantId: string;
  onClose: () => void;
  onPaid: () => void;
  onFailed: (message: string) => void;
};

export function MollieCheckoutModal({
  visible,
  checkoutUrl,
  molliePaymentId,
  restaurantId,
  onClose,
  onPaid,
  onFailed,
}: MollieCheckoutModalProps) {
  const styles = useThemedStyles(createStyles);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible || !molliePaymentId) return;

    const poll = async () => {
      try {
        const result = await recheckMolliePayment({
          restaurantId,
          molliePaymentId,
        });
        if (result.status === "paid") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          onPaid();
        } else if (
          result.status === "failed" ||
          result.status === "canceled" ||
          result.status === "expired"
        ) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          onFailed("Zahlung abgebrochen oder fehlgeschlagen.");
        }
      } catch {
        // keep polling
      }
    };

    void poll();
    pollingRef.current = setInterval(() => void poll(), 2500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [visible, molliePaymentId, restaurantId, onPaid, onFailed]);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.header}>
        <Text style={styles.title}>Zahlung ausstehend</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.close}>Schließen</Text>
        </Pressable>
      </View>
      {checkoutUrl ? (
        <WebView source={{ uri: checkoutUrl }} style={styles.webview} />
      ) : (
        <View style={styles.waiting}>
          <ActivityIndicator size="large" />
          <Text style={styles.waitingText}>
            Zahlung wird verarbeitet …
          </Text>
        </View>
      )}
    </Modal>
  );
}

type UseMollieCheckoutParams = {
  restaurantId: string | undefined;
  onSuccess: () => void;
};

export function useMollieCheckout({
  restaurantId,
  onSuccess,
  onFailed,
}: UseMollieCheckoutParams & { onFailed: (message: string) => void }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [molliePaymentId, setMolliePaymentId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startPayment = useCallback(
    async (params: {
      method: MolliePaymentMethod;
      orderId?: string;
      tableSessionId?: string;
      allocations?: Array<{ orderLineId: string; quantity: number }>;
    }) => {
      if (!restaurantId) return;
      setStarting(true);
      try {
        const result = await createMolliePayment({
          restaurantId,
          ...params,
        });
        setMolliePaymentId(result.molliePaymentId);
        setCheckoutUrl(result.checkoutUrl);
        setCheckoutOpen(true);
      } catch (err) {
        const message = posApiErrorMessage(err, "Zahlung fehlgeschlagen");
        if (message.includes("mollie_not_configured")) {
          throw new Error(
            "Mollie ist für dieses Restaurant nicht eingerichtet. Bitte unter Web → Einstellungen → Integrationen verbinden.",
          );
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setStarting(false);
      }
    },
    [restaurantId],
  );

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    setCheckoutUrl(null);
    setMolliePaymentId(null);
  }, []);

  const modal = (
    <MollieCheckoutModal
      visible={checkoutOpen}
      checkoutUrl={checkoutUrl}
      molliePaymentId={molliePaymentId}
      restaurantId={restaurantId ?? ""}
      onClose={closeCheckout}
      onPaid={() => {
        closeCheckout();
        onSuccess();
      }}
      onFailed={(msg) => {
        closeCheckout();
        onFailed(msg);
      }}
    />
  );

  return { startPayment, starting, modal, checkoutOpen };
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: gwadaSpacing.lg,
      paddingVertical: gwadaSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
      backgroundColor: colors.surface,
    },
    title: { fontSize: 17, fontWeight: "600", color: colors.text },
    close: { fontSize: 16, color: colors.accent },
    webview: { flex: 1 },
    waiting: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: gwadaSpacing.md,
      backgroundColor: colors.groupedBackground,
    },
    waitingText: { fontSize: 15, color: colors.textMuted },
  });
}
