import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { SkeletonList } from "@/src/components/Skeleton";
import { Card } from "@/src/components/ui";
import { createOrder } from "@/src/lib/pos-api";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
};

type CartLine = {
  menuItemId: string;
  name: string;
  unitCents: number;
  quantity: number;
};

export default function NewOrderScreen() {
  const router = useRouter();
  const { sessionId, tableLabel } = useLocalSearchParams<{
    sessionId: string;
    tableLabel?: string;
  }>();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ["menu-items", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const sb = getStaffSupabase();
      const { data, error } = await sb
        .from("menu_items")
        .select("id, name, price, is_active")
        .eq("restaurant_id", restaurantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as MenuItemRow[];
    },
  });

  const totalCents = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitCents * line.quantity, 0),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );

  const showSkeleton = useDeferredSkeleton(isLoading);

  const addItem = (item: MenuItemRow) => {
    const unitCents = Math.round(Number(item.price) * 100);
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, unitCents, quantity: 1 },
      ];
    });
    setCartOpen(true);
  };

  const changeQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.menuItemId === menuItemId
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  };

  const submit = async () => {
    if (!restaurantId || !sessionId || cart.length === 0) return;
    setSubmitting(true);
    try {
      const result = await createOrder({
        restaurantId,
        tableSessionId: sessionId,
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
        })),
      });
      router.replace({
        pathname: "/order/[id]",
        params: { id: result.orderId },
      });
    } catch (err) {
      Alert.alert(
        "Bestellung fehlgeschlagen",
        err instanceof Error ? err.message : "Unbekannter Fehler",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.context}>
        {tableLabel ?? "Tisch"} · {itemCount} Artikel · {formatCentsEUR(totalCents)}
      </Text>

      {showSkeleton ? (
        <SkeletonList count={8} />
      ) : (
        <FlatList
          data={menuItems ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            cart.length > 0 && styles.listWithCart,
          ]}
          ListEmptyComponent={
            <Text style={styles.empty}>Keine aktiven Gerichte in der Speisekarte.</Text>
          }
          renderItem={({ item }) => (
            <Card onPress={() => addItem(item)}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
                {formatCentsEUR(Math.round(Number(item.price) * 100))}
              </Text>
            </Card>
          )}
        />
      )}

      {cart.length > 0 ? (
        <View style={styles.cartSheet}>
          <Pressable
            onPress={() => setCartOpen((v) => !v)}
            style={styles.cartHeader}
          >
            <Text style={styles.cartTitle}>
              Warenkorb ({itemCount}) · {formatCentsEUR(totalCents)}
            </Text>
            <Text style={styles.cartToggle}>{cartOpen ? "▼" : "▲"}</Text>
          </Pressable>

          {cartOpen ? (
            <View style={styles.cartLines}>
              {cart.map((line) => (
                <View key={line.menuItemId} style={styles.cartLine}>
                  <View style={styles.cartLineText}>
                    <Text style={styles.cartLineName}>{line.name}</Text>
                    <Text style={styles.cartLinePrice}>
                      {formatCentsEUR(line.unitCents * line.quantity)}
                    </Text>
                  </View>
                  <View style={styles.qtyRow}>
                    <Pressable
                      onPress={() => changeQty(line.menuItemId, -1)}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <Pressable
                      onPress={() => changeQty(line.menuItemId, 1)}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Button
            label={`Bestellung senden (${formatCentsEUR(totalCents)})`}
            loading={submitting}
            disabled={cart.length === 0}
            onPress={() => void submit()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: gwadaColors.background,
    padding: gwadaSpacing.lg,
  },
  context: {
    fontSize: 14,
    color: gwadaColors.textMuted,
    marginBottom: gwadaSpacing.md,
  },
  list: { gap: 10, paddingBottom: gwadaSpacing.lg },
  listWithCart: { paddingBottom: 220 },
  empty: { textAlign: "center", color: gwadaColors.textMuted, padding: 24 },
  itemName: { fontSize: 16, fontWeight: "600", color: gwadaColors.text },
  itemPrice: { fontSize: 14, color: gwadaColors.textMuted, marginTop: 4 },
  cartSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: gwadaColors.surface,
    borderTopWidth: 1,
    borderTopColor: gwadaColors.border,
    padding: gwadaSpacing.lg,
    gap: gwadaSpacing.sm,
    borderTopLeftRadius: gwadaRadii.card,
    borderTopRightRadius: gwadaRadii.card,
  },
  cartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartTitle: { fontSize: 15, fontWeight: "700", color: gwadaColors.text },
  cartToggle: { fontSize: 12, color: gwadaColors.textMuted },
  cartLines: { gap: 8, maxHeight: 160 },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cartLineText: { flex: 1 },
  cartLineName: { fontSize: 14, fontWeight: "600", color: gwadaColors.text },
  cartLinePrice: { fontSize: 13, color: gwadaColors.textMuted, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: gwadaColors.background,
  },
  qtyBtnText: { fontSize: 18, fontWeight: "600", color: gwadaColors.text },
  qtyValue: {
    minWidth: 20,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: gwadaColors.text,
  },
});
