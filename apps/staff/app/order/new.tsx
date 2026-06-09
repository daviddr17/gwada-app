import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import {
  OrderCartSheet,
  type OrderCartLine,
} from "@/src/components/OrderCartSheet";
import { SkeletonList } from "@/src/components/Skeleton";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { createOrder } from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

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
  const { colors } = useStaffTheme();
  const { sessionId } = useLocalSearchParams<{
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

  const styles = useThemedStyles(createStyles);
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
      {showSkeleton ? (
        <SkeletonList count={8} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          {menuSections.length === 0 ? (
            <Text allowFontScaling style={styles.empty}>
              Keine aktiven Gerichte in der Speisekarte.
            </Text>
          ) : (
            menuSections.map((section) => (
              <GroupedSection
                key={section.title}
                title={section.title}
                style={styles.menuSection}
              >
                <GroupedList>
                  {section.data.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 ? <ListSeparator /> : null}
                      <ListRow
                        label={item.name}
                        value={formatCentsEUR(
                          Math.round(Number(item.price) * 100),
                        )}
                        variant="navigation"
                        onPress={() => addItem(item)}
                      />
                    </View>
                  ))}
                </GroupedList>
              </GroupedSection>
            ))
          )}
        </ScrollView>
      )}

      {cart.length > 0 ? (
        <Pressable
          onPress={() => setCartSheetOpen(true)}
          style={[styles.cartBar, { paddingBottom: cartBarBottomInset }]}
          accessibilityRole="button"
          accessibilityLabel="Warenkorb öffnen"
        >
          <Text allowFontScaling style={styles.cartBarTitle}>
            Warenkorb ({itemCount}) · {formatCentsEUR(totalCents)}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textMuted}
          />
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

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
      paddingHorizontal: gwadaSpacing.md,
      paddingTop: gwadaSpacing.sm,
    },
    menuSection: {
      marginBottom: gwadaSpacing.md,
    },
    empty: { textAlign: "center", color: colors.textMuted, padding: 24 },
    cartBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: -gwadaSpacing.md,
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.md,
      minHeight: CART_BAR_HEIGHT,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
    },
    cartBarTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  });
}
