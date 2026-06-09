import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import {
  OrderCartSheet,
  type OrderCartLine,
} from "@/src/components/OrderCartSheet";
import { SkeletonList } from "@/src/components/Skeleton";
import { Card } from "@/src/components/ui";
import { createOrder } from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

const CART_BAR_HEIGHT = 56;

type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  category_id: string;
  menu_categories: {
    id: string;
    name: string;
    sort_order: number;
  } | null;
};

export default function NewOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId, tableLabel } = useLocalSearchParams<{
    sessionId: string;
    tableLabel?: string;
  }>();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const [cart, setCart] = useState<OrderCartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ["menu-items", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const sb = getStaffSupabase();
      const { data, error } = await sb
        .from("menu_items")
        .select(
          "id, name, price, is_active, category_id, menu_categories(id, name, sort_order)",
        )
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

  const menuSections = useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; sortOrder: number; data: MenuItemRow[] }
    >();

    for (const item of menuItems ?? []) {
      const category = item.menu_categories;
      const key = category?.id ?? "other";
      const title = category?.name ?? "Sonstiges";
      const sortOrder = category?.sort_order ?? 9999;
      const bucket = grouped.get(key) ?? { title, sortOrder, data: [] };
      bucket.data.push(item);
      grouped.set(key, bucket);
    }

    return [...grouped.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map((section) => ({
        title: section.title,
        data: section.data.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [menuItems]);

  const showSkeleton = useDeferredSkeleton(isLoading);

  const cartBarBottomInset = Math.max(insets.bottom, gwadaSpacing.sm);
  const listBottomPadding =
    cart.length > 0 ? CART_BAR_HEIGHT + cartBarBottomInset + gwadaSpacing.sm : gwadaSpacing.lg;

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
      setCartSheetOpen(false);
      router.replace({
        pathname: "/order/[id]",
        params: { id: result.orderId },
      });
    } catch (err) {
      Alert.alert(
        "Bestellung fehlgeschlagen",
        posApiErrorMessage(err, "Unbekannter Fehler"),
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
        <SectionList
          style={styles.list}
          sections={menuSections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Keine aktiven Gerichte in der Speisekarte.</Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
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
        <Pressable
          onPress={() => setCartSheetOpen(true)}
          style={[
            styles.cartBar,
            { paddingBottom: cartBarBottomInset },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Warenkorb öffnen"
        >
          <Text style={styles.cartBarTitle}>
            Warenkorb ({itemCount}) · {formatCentsEUR(totalCents)}
          </Text>
          <Text style={styles.cartBarChevron}>›</Text>
        </Pressable>
      ) : null}

      <OrderCartSheet
        visible={cartSheetOpen}
        lines={cart}
        totalCents={totalCents}
        itemCount={itemCount}
        submitting={submitting}
        onClose={() => setCartSheetOpen(false)}
        onChangeQty={changeQty}
        onSubmit={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: gwadaColors.background,
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: gwadaSpacing.lg,
  },
  context: {
    fontSize: 14,
    color: gwadaColors.textMuted,
    marginBottom: gwadaSpacing.md,
  },
  list: { flex: 1 },
  sectionHeader: {
    backgroundColor: gwadaColors.background,
    paddingTop: gwadaSpacing.md,
    paddingBottom: gwadaSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: gwadaColors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: gwadaColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  itemSeparator: { height: 10 },
  empty: { textAlign: "center", color: gwadaColors.textMuted, padding: 24 },
  itemName: { fontSize: 16, fontWeight: "600", color: gwadaColors.text },
  itemPrice: { fontSize: 14, color: gwadaColors.textMuted, marginTop: 4 },
  cartBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: -gwadaSpacing.lg,
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: gwadaSpacing.md,
    minHeight: CART_BAR_HEIGHT,
    backgroundColor: gwadaColors.surface,
    borderTopWidth: 1,
    borderTopColor: gwadaColors.border,
    borderTopLeftRadius: gwadaRadii.card,
    borderTopRightRadius: gwadaRadii.card,
  },
  cartBarTitle: { fontSize: 15, fontWeight: "700", color: gwadaColors.text },
  cartBarChevron: { fontSize: 22, fontWeight: "600", color: gwadaColors.textMuted },
});
