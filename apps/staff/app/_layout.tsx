import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/src/stores/auth-store";
import { StaffThemeProvider } from "@/src/theme/staff-theme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, activeRestaurantId, isLoading, init } = useAuthStore();

  useEffect(() => {
    void init().finally(() => SplashScreen.hideAsync());
  }, [init]);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "login";
    const inRestaurantSelect = segments[0] === "restaurant-select";

    if (!session) {
      if (!inAuth) router.replace("/login");
      return;
    }

    if (!activeRestaurantId) {
      if (!inRestaurantSelect) router.replace("/restaurant-select");
      return;
    }

    if (inAuth || inRestaurantSelect) {
      router.replace("/(tabs)/tables");
    }
  }, [session, activeRestaurantId, isLoading, segments, router]);

  return children;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StaffThemeProvider>
          <AuthGate>
            <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="restaurant-select" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="order/new"
              options={{
                headerShown: true,
                title: "Neue Bestellung",
                headerBackTitle: "Zurück",
              }}
            />
            <Stack.Screen
              name="order/[id]"
              options={{
                headerShown: true,
                title: "Bestellung",
                headerBackTitle: "Zurück",
              }}
            />
          </Stack>
          </AuthGate>
        </StaffThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
