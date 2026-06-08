import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonList } from "@/src/components/Skeleton";
import { Card, ScreenHeader } from "@/src/components/ui";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { openTableSession } from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaSpacing } from "@/src/theme/tokens";

type DiningTableRow = {
  id: string;
  table_number: number;
  table_name: string | null;
  is_active: boolean;
};

export default function TablesScreen() {
  const router = useRouter();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dining-tables", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: async () => {
      const sb = getStaffSupabase();
      const { data: rows, error } = await sb
        .from("dining_tables")
        .select("id, table_number, table_name, is_active")
        .eq("restaurant_id", restaurantId!)
        .eq("is_active", true)
        .order("table_number");
      if (error) throw new Error(error.message);
      return (rows ?? []) as DiningTableRow[];
    },
  });

  const handleTablePress = async (table: DiningTableRow) => {
    if (!restaurantId) return;
    try {
      const { sessionId } = await openTableSession({
        restaurantId,
        diningTableId: table.id,
        coverCount: 1,
      });
      router.push({
        pathname: "/order/new",
        params: {
          sessionId,
          tableLabel: table.table_name ?? `Tisch ${table.table_number}`,
        },
      });
    } catch (err) {
      Alert.alert(
        "Tisch öffnen fehlgeschlagen",
        posApiErrorMessage(err, "Tisch-Session konnte nicht geöffnet werden."),
      );
    }
  };

  const showSkeleton = useDeferredSkeleton(isLoading);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader
          title="Tische"
          subtitle="Tisch wählen und Bestellung starten"
        />

        {showSkeleton ? (
          <SkeletonList count={6} />
        ) : isLoading ? (
          <View style={styles.listPlaceholder} aria-busy />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.empty}>Keine aktiven Tische.</Text>
                <Text style={styles.emptyHint}>
                  Tische im Web unter Reservierungen → Tischplan anlegen, oder lokal:
                  {"\n"}pnpm db:seed:dining-floor
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card onPress={() => void handleTablePress(item)}>
                <Text style={styles.tableName}>
                  {item.table_name ?? `Tisch ${item.table_number}`}
                </Text>
                <Text style={styles.tableMeta}>Nr. {item.table_number}</Text>
              </Card>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: gwadaColors.background },
  container: { flex: 1, padding: gwadaSpacing.lg },
  list: { gap: 12, paddingBottom: gwadaSpacing.xl },
  listPlaceholder: { flex: 1, minHeight: 200 },
  tableName: { fontSize: 18, fontWeight: "600", color: gwadaColors.text },
  tableMeta: { fontSize: 14, color: gwadaColors.textMuted, marginTop: 4 },
  emptyBox: { padding: 24, gap: 8 },
  empty: { textAlign: "center", color: gwadaColors.text, fontWeight: "600" },
  emptyHint: {
    textAlign: "center",
    color: gwadaColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
